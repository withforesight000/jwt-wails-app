package app

import (
	"crypto/ecdsa"
	"crypto/ed25519"
	"crypto/rsa"
	"crypto/x509"
	"encoding/json"
	"encoding/pem"
	"errors"
	"strings"
	"time"

	jwt "github.com/golang-jwt/jwt/v5"
)

// JWTResult はフロントへ返す検証・デコード結果
// *time.Time は Wails のコード生成と相性が悪い場合があるため、Unix 秒の *int64 を返す
// （TS 側で number | null として扱える）
type JWTResult struct {
	Valid     bool           `json:"valid"`
	Algorithm string         `json:"algorithm"`
	Header    map[string]any `json:"header"`
	Claims    map[string]any `json:"claims"`
	IssuedAt  *int64         `json:"iat,omitempty"`
	NotBefore *int64         `json:"nbf,omitempty"`
	ExpiresAt *int64         `json:"exp,omitempty"`
	Error     string         `json:"error,omitempty"`
	Warnings  []string       `json:"warnings,omitempty"`
	Signature string         `json:"signature,omitempty"`
}

// VerifyAndDecodeJWT は JWT を未検証デコードし、鍵があれば署名検証も行う
func (a *App) VerifyAndDecodeJWT(tokenString string, keyBytes []byte) (*JWTResult, error) {
	res := &JWTResult{}
	if strings.TrimSpace(tokenString) == "" {
		return nil, backendError(codeEmptyToken)
	}

	parts := strings.Split(tokenString, ".")
	if len(parts) != 3 {
		return nil, backendError(codeTokenMustHave3Parts)
	}
	res.Signature = parts[2]

	parser := jwt.NewParser()
	unver := jwt.MapClaims{}
	tok, _, err := parser.ParseUnverified(tokenString, unver)
	if err != nil {
		return nil, backendError(codeParseUnverified)
	}
	res.Header = tok.Header
	if alg, ok := tok.Header["alg"].(string); ok {
		res.Algorithm = alg
	}
	res.Claims = map[string]any(unver)
	res.IssuedAt = extractUnix(unver, "iat")
	res.NotBefore = extractUnix(unver, "nbf")
	res.ExpiresAt = extractUnix(unver, "exp")

	// 鍵未指定ならデコードのみ
	if len(keyBytes) == 0 {
		res.Valid = false
		res.Warnings = append(res.Warnings, codeNoKeyWarning)
		return res, nil
	}

	alg := res.Algorithm
	if alg == "" {
		res.Error = codeMissingAlgHeader
		return res, nil
	}

	key, err := selectKeyForAlg(alg, keyBytes)
	if err != nil {
		res.Error = err.Error()
		return res, nil
	}

	claims := jwt.MapClaims{}
	parsed, err := jwt.ParseWithClaims(tokenString, claims, func(t *jwt.Token) (interface{}, error) {
		if t.Method.Alg() != alg {
			return nil, backendError(codeAlgMismatch)
		}
		return key, nil
	}, jwt.WithLeeway(2*time.Second))
	if err != nil {
		res.Valid = false
		switch {
		case strings.Contains(err.Error(), codeAlgMismatch):
			res.Error = codeAlgMismatch
		default:
			if code := codeForJWTError(err); code != "" {
				res.Error = code
			} else {
				res.Error = err.Error()
			}
		}
	} else {
		res.Valid = parsed.Valid
	}
	res.Claims = map[string]any(claims)
	res.IssuedAt = extractUnix(claims, "iat")
	res.NotBefore = extractUnix(claims, "nbf")
	res.ExpiresAt = extractUnix(claims, "exp")
	return res, nil
}

// extractUnix は iat/nbf/exp を秒精度の *int64 に正規化
func extractUnix(m jwt.MapClaims, key string) *int64 {
	v, ok := m[key]
	if !ok {
		return nil
	}
	switch tv := v.(type) {
	case float64:
		u := int64(tv)
		return &u
	case json.Number:
		if i, err := tv.Int64(); err == nil {
			return &i
		}
	case string:
		var num json.Number = json.Number(tv)
		if i, err := num.Int64(); err == nil {
			return &i
		}
	}
	return nil
}

// アルゴリズムに応じて鍵を解釈（PEM/DER の両方をサポート）
func selectKeyForAlg(alg string, keyBytes []byte) (any, error) {
	switch {
	case strings.HasPrefix(alg, "HS"): // HMAC 共有鍵は生バイト
		return keyBytes, nil
	case strings.HasPrefix(alg, "RS"), strings.HasPrefix(alg, "PS"): // RSA / RSASSA-PSS
		return parseRSAPubOrPrivPEMOrDER(keyBytes)
	case strings.HasPrefix(alg, "ES"): // ECDSA
		return parseECDSAPubOrPrivPEMOrDER(keyBytes)
	case alg == "EdDSA": // Ed25519
		return parseEd25519PubOrPrivPEMOrDER(keyBytes)
	default:
		return nil, backendError(codeUnsupportedAlg)
	}
}

// ===== RSA: PUBLIC/PRIVATE/CERT (PEM or DER) =====
func parseRSAPubOrPrivPEMOrDER(b []byte) (any, error) {
	if k, err := parseRSAPEM(b); err == nil { // PEM 成功
		return k, nil
	}
	// PEM として解釈できなければ DER として総当たり
	if k, err := parseRSADER(b); err == nil {
		return k, nil
	}
	return nil, backendError(codeRSAKeyParseFailed)
}

func parseRSAPEM(b []byte) (any, error) {
	blk, _ := pem.Decode(b)
	if blk == nil {
		return nil, errors.New("not pem")
	}
	switch blk.Type {
	case "PUBLIC KEY": // SubjectPublicKeyInfo (SPKI)
		pub, err := x509.ParsePKIXPublicKey(blk.Bytes)
		if err != nil {
			return nil, backendError(codeRSAPEMBlockParseFailed)
		}
		if rsaPub, ok := pub.(*rsa.PublicKey); ok {
			return rsaPub, nil
		}
		return nil, backendError(codeRSANotPublicKey)
	case "RSA PUBLIC KEY": // PKCS#1 public
		pub, err := x509.ParsePKCS1PublicKey(blk.Bytes)
		if err != nil {
			return nil, backendError(codeRSAPEMBlockParseFailed)
		}
		return pub, nil
	case "CERTIFICATE": // X.509 cert
		cert, err := x509.ParseCertificate(blk.Bytes)
		if err != nil {
			return nil, backendError(codeRSAPEMBlockParseFailed)
		}
		if rsaPub, ok := cert.PublicKey.(*rsa.PublicKey); ok {
			return rsaPub, nil
		}
		return nil, backendError(codeRSACertMissingPublicKey)
	case "PRIVATE KEY": // PKCS#8 private
		priv, err := x509.ParsePKCS8PrivateKey(blk.Bytes)
		if err != nil {
			return nil, backendError(codeRSAPEMBlockParseFailed)
		}
		if rsaPriv, ok := priv.(*rsa.PrivateKey); ok {
			return rsaPriv.Public(), nil
		}
		return nil, backendError(codeRSAPKCS8NotRSA)
	case "RSA PRIVATE KEY": // PKCS#1 private
		priv, err := x509.ParsePKCS1PrivateKey(blk.Bytes)
		if err != nil {
			return nil, backendError(codeRSAPEMBlockParseFailed)
		}
		return priv.Public(), nil
	default:
		return nil, backendError(codeRSAUnknownPEMType)
	}
}

func parseRSADER(der []byte) (any, error) {
	// 順に試す: PKCS#1 public → SPKI public → cert → PKCS#8 priv → PKCS#1 priv
	if pub1, err := x509.ParsePKCS1PublicKey(der); err == nil {
		return pub1, nil
	}
	if pub, err := x509.ParsePKIXPublicKey(der); err == nil {
		if rsaPub, ok := pub.(*rsa.PublicKey); ok {
			return rsaPub, nil
		}
	}
	if cert, err := x509.ParseCertificate(der); err == nil {
		if rsaPub, ok := cert.PublicKey.(*rsa.PublicKey); ok {
			return rsaPub, nil
		}
	}
	if priv8, err := x509.ParsePKCS8PrivateKey(der); err == nil {
		if rsaPriv, ok := priv8.(*rsa.PrivateKey); ok {
			return rsaPriv.Public(), nil
		}
	}
	if priv1, err := x509.ParsePKCS1PrivateKey(der); err == nil {
		return priv1.Public(), nil
	}
	return nil, backendError(codeRSADERUnparseable)
}

// ===== ECDSA: PUBLIC/PRIVATE/CERT (PEM or DER) =====
func parseECDSAPubOrPrivPEMOrDER(b []byte) (any, error) {
	if k, err := parseECDSAPEM(b); err == nil {
		return k, nil
	}
	if k, err := parseECDSADER(b); err == nil {
		return k, nil
	}
	return nil, backendError(codeECDSAKeyParseFailed)
}

func parseECDSAPEM(b []byte) (any, error) {
	blk, _ := pem.Decode(b)
	if blk == nil {
		return nil, errors.New("not pem")
	}
	switch blk.Type {
	case "PUBLIC KEY": // SPKI
		pub, err := x509.ParsePKIXPublicKey(blk.Bytes)
		if err != nil {
			return nil, backendError(codeECDSAPEMBlockParseFailed)
		}
		if ecdsaPub, ok := pub.(*ecdsa.PublicKey); ok {
			return ecdsaPub, nil
		}
		return nil, backendError(codeECDSANotPublicKey)
	case "CERTIFICATE":
		cert, err := x509.ParseCertificate(blk.Bytes)
		if err != nil {
			return nil, backendError(codeECDSAPEMBlockParseFailed)
		}
		if ecdsaPub, ok := cert.PublicKey.(*ecdsa.PublicKey); ok {
			return ecdsaPub, nil
		}
		return nil, backendError(codeECDSACertMissingPublicKey)
	case "EC PRIVATE KEY": // SEC1
		priv, err := x509.ParseECPrivateKey(blk.Bytes)
		if err != nil {
			return nil, backendError(codeECDSAPEMBlockParseFailed)
		}
		return &priv.PublicKey, nil
	case "PRIVATE KEY": // PKCS#8
		priv, err := x509.ParsePKCS8PrivateKey(blk.Bytes)
		if err != nil {
			return nil, backendError(codeECDSAPEMBlockParseFailed)
		}
		if ecdsaPriv, ok := priv.(*ecdsa.PrivateKey); ok {
			return &ecdsaPriv.PublicKey, nil
		}
		return nil, backendError(codeECDSAPKCS8NotECDSA)
	default:
		return nil, backendError(codeECDSAUnknownPEMType)
	}
}

func parseECDSADER(der []byte) (any, error) {
	// 順に試す: SPKI public → cert → PKCS#8 priv → EC private (SEC1)
	if pub, err := x509.ParsePKIXPublicKey(der); err == nil {
		if ecdsaPub, ok := pub.(*ecdsa.PublicKey); ok {
			return ecdsaPub, nil
		}
	}
	if cert, err := x509.ParseCertificate(der); err == nil {
		if ecdsaPub, ok := cert.PublicKey.(*ecdsa.PublicKey); ok {
			return ecdsaPub, nil
		}
	}
	if priv8, err := x509.ParsePKCS8PrivateKey(der); err == nil {
		if ecdsaPriv, ok := priv8.(*ecdsa.PrivateKey); ok {
			return &ecdsaPriv.PublicKey, nil
		}
	}
	if ecPriv, err := x509.ParseECPrivateKey(der); err == nil {
		return &ecPriv.PublicKey, nil
	}
	return nil, backendError(codeECDSADERUnparseable)
}

// ===== Ed25519: PUBLIC/PRIVATE/CERT (PEM or DER) =====
func parseEd25519PubOrPrivPEMOrDER(b []byte) (any, error) {
	if k, err := parseEd25519PEM(b); err == nil {
		return k, nil
	}
	if k, err := parseEd25519DER(b); err == nil {
		return k, nil
	}
	return nil, backendError(codeEd25519KeyParseFailed)
}

func parseEd25519PEM(b []byte) (any, error) {
	blk, _ := pem.Decode(b)
	if blk == nil {
		return nil, errors.New("not pem")
	}
	switch blk.Type {
	case "PUBLIC KEY": // SPKI
		pub, err := x509.ParsePKIXPublicKey(blk.Bytes)
		if err != nil {
			return nil, backendError(codeEd25519PEMBlockParseFailed)
		}
		if edPub, ok := pub.(ed25519.PublicKey); ok {
			return edPub, nil
		}
		return nil, backendError(codeEd25519NotPublicKey)
	case "CERTIFICATE":
		cert, err := x509.ParseCertificate(blk.Bytes)
		if err != nil {
			return nil, backendError(codeEd25519PEMBlockParseFailed)
		}
		if edPub, ok := cert.PublicKey.(ed25519.PublicKey); ok {
			return edPub, nil
		}
		return nil, backendError(codeEd25519CertMissingPublicKey)
	case "PRIVATE KEY": // PKCS#8
		priv, err := x509.ParsePKCS8PrivateKey(blk.Bytes)
		if err != nil {
			return nil, backendError(codeEd25519PEMBlockParseFailed)
		}
		if edPriv, ok := priv.(ed25519.PrivateKey); ok {
			return edPriv.Public(), nil
		}
		return nil, backendError(codeEd25519PKCS8NotEd25519)
	default:
		return nil, backendError(codeEd25519UnknownPEMType)
	}
}

func parseEd25519DER(der []byte) (any, error) {
	// 順に試す: SPKI public → cert → PKCS#8 priv
	if pub, err := x509.ParsePKIXPublicKey(der); err == nil {
		if edPub, ok := pub.(ed25519.PublicKey); ok {
			return edPub, nil
		}
	}
	if cert, err := x509.ParseCertificate(der); err == nil {
		if edPub, ok := cert.PublicKey.(ed25519.PublicKey); ok {
			return edPub, nil
		}
	}
	if priv8, err := x509.ParsePKCS8PrivateKey(der); err == nil {
		if edPriv, ok := priv8.(ed25519.PrivateKey); ok {
			return edPriv.Public(), nil
		}
	}
	return nil, backendError(codeEd25519DERUnparseable)
}
