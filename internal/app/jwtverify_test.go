package app

import (
	"bytes"
	"crypto/ecdsa"
	"crypto/ed25519"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"fmt"
	"math/big"
	"strings"
	"testing"
	"time"

	jwt "github.com/golang-jwt/jwt/v5"
)

func TestVerifyAndDecodeJWT_EmptyToken(t *testing.T) {
	t.Helper()
	app := NewApp()

	_, err := app.VerifyAndDecodeJWT("", nil)
	if err == nil {
		t.Fatalf("expected error for empty token")
	}
	if err.Error() != codeEmptyToken {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestVerifyAndDecodeJWT_NoKey(t *testing.T) {
	app := NewApp()
	now := time.Now().Unix()
	token := generateHS256Token(t, []byte("shared-secret"), jwt.MapClaims{
		"foo": "bar",
		"iat": now,
	})

	res, err := app.VerifyAndDecodeJWT(token, nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if res.Valid {
		t.Fatalf("expected valid=false when key is missing")
	}
	if len(res.Warnings) == 0 || res.Warnings[0] != codeNoKeyWarning {
		t.Fatalf("missing warning: %v", res.Warnings)
	}
	parts := strings.Split(token, ".")
	if res.Signature == "" || len(parts) != 3 || res.Signature != parts[2] {
		t.Fatalf("signature not captured")
	}
	if res.Algorithm != "HS256" {
		t.Fatalf("unexpected algorithm: %s", res.Algorithm)
	}
	if res.Claims["foo"] != "bar" {
		t.Fatalf("claim lost: %v", res.Claims)
	}
	if res.IssuedAt == nil || *res.IssuedAt != now {
		t.Fatalf("iat not preserved: %v", res.IssuedAt)
	}
}

func TestVerifyAndDecodeJWT_InvalidStructure(t *testing.T) {
	app := NewApp()

	_, err := app.VerifyAndDecodeJWT("part1.part2", nil)
	if err == nil {
		t.Fatalf("expected structure error")
	}
	if err.Error() != codeTokenMustHave3Parts {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestVerifyAndDecodeJWT_MissingAlgHeader(t *testing.T) {
	app := NewApp()
	token := makeManualToken(map[string]any{"typ": "JWT"}, map[string]any{"foo": "bar"}, "sig")

	_, err := app.VerifyAndDecodeJWT(token, []byte("key"))
	if err == nil {
		t.Fatal("expected parse error for missing alg")
	}
	if err.Error() != codeParseUnverified {
		t.Fatalf("expected parse_unverified code, got: %v", err)
	}
}

func TestVerifyAndDecodeJWT_UnsupportedAlg(t *testing.T) {
	app := NewApp()
	headers := map[string]any{"alg": "XYZ", "typ": "JWT"}
	token := makeManualToken(headers, map[string]any{"foo": "bar"}, "bare")

	_, err := app.VerifyAndDecodeJWT(token, []byte("key"))
	if err == nil {
		t.Fatal("expected parse error for unsupported alg")
	}
	if err.Error() != codeParseUnverified {
		t.Fatalf("expected parse_unverified code, got: %v", err)
	}
}

func TestVerifyAndDecodeJWT_InvalidBase64(t *testing.T) {
	app := NewApp()
	_, err := app.VerifyAndDecodeJWT("!!?.!!?.!!?", []byte("key"))
	if err == nil {
		t.Fatal("expected parse error")
	}
	if err.Error() != codeParseUnverified {
		t.Fatalf("unexpected error code: %v", err)
	}
}

func TestExtractUnixVariants(t *testing.T) {
	m := jwt.MapClaims{
		"float":  1.9,
		"json":   json.Number("123"),
		"string": "456",
		"bad":    "yikes",
	}
	if v := extractUnix(m, "float"); v == nil || *v != 1 {
		t.Fatalf("expected truncation of float, got %v", v)
	}
	if v := extractUnix(m, "json"); v == nil || *v != 123 {
		t.Fatalf("expected json number, got %v", v)
	}
	if v := extractUnix(m, "string"); v == nil || *v != 456 {
		t.Fatalf("expected string number, got %v", v)
	}
	if extractUnix(m, "bad") != nil {
		t.Fatalf("expected invalid string to be nil")
	}
}

func TestVerifyAndDecodeJWT_RS256(t *testing.T) {
	priv, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("failed to generate RSA key: %v", err)
	}

	now := time.Now()
	claims := jwt.MapClaims{
		"sub": "tester",
		"foo": "rsa",
		"iat": now.Unix(),
		"nbf": now.Unix(),
		"exp": now.Add(time.Hour).Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)
	signed, err := token.SignedString(priv)
	if err != nil {
		t.Fatalf("failed to sign token: %v", err)
	}

	app := NewApp()
	res, err := app.VerifyAndDecodeJWT(signed, encodeRSAPublicPEM(t, &priv.PublicKey))
	if err != nil {
		t.Fatalf("verification failed: %v", err)
	}
	if !res.Valid {
		t.Fatalf("expected valid signature")
	}
	if res.Algorithm != "RS256" {
		t.Fatalf("unexpected algorithm: %s", res.Algorithm)
	}
	if res.IssuedAt == nil || *res.IssuedAt != claims["iat"] {
		t.Fatalf("iat mismatch: %v vs %v", res.IssuedAt, claims["iat"])
	}
	if res.NotBefore == nil || *res.NotBefore != claims["nbf"] {
		t.Fatalf("nbf mismatch: %v vs %v", res.NotBefore, claims["nbf"])
	}
	if res.ExpiresAt == nil || *res.ExpiresAt != claims["exp"] {
		t.Fatalf("exp mismatch: %v vs %v", res.ExpiresAt, claims["exp"])
	}
	if res.Claims["foo"] != "rsa" || res.Claims["sub"] != "tester" {
		t.Fatalf("claims lost: %v", res.Claims)
	}
	if res.Signature == "" {
		t.Fatalf("signature missing")
	}
}

func TestVerifyAndDecodeJWT_InvalidRSAKey(t *testing.T) {
	priv, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("failed to generate RSA key: %v", err)
	}
	token := jwt.NewWithClaims(jwt.SigningMethodRS256, jwt.MapClaims{"foo": "bar"})
	signed, err := token.SignedString(priv)
	if err != nil {
		t.Fatalf("failed to sign token: %v", err)
	}

	app := NewApp()
	res, err := app.VerifyAndDecodeJWT(signed, []byte("not a key"))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if res.Error != codeRSAKeyParseFailed {
		t.Fatalf("expected RSA key parse code, got: %v", res.Error)
	}
}

func TestVerifyAndDecodeJWT_RS256SignatureMismatch(t *testing.T) {
	priv1, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("failed to generate RSA key: %v", err)
	}
	priv2, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("failed to generate RSA key: %v", err)
	}
	token := jwt.NewWithClaims(jwt.SigningMethodRS256, jwt.MapClaims{"foo": "bar"})
	signed, err := token.SignedString(priv1)
	if err != nil {
		t.Fatalf("failed to sign token: %v", err)
	}

	app := NewApp()
	res, err := app.VerifyAndDecodeJWT(signed, encodeRSAPublicPEM(t, &priv2.PublicKey))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if res.Valid {
		t.Fatalf("expected signature verification to fail")
	}
	if res.Error != codeTokenSignatureInvalid {
		t.Fatalf("expected signature mismatch code, got: %v", res.Error)
	}
}

func TestSelectKeyForAlg_RSA(t *testing.T) {
	priv, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("failed to generate RSA key: %v", err)
	}
	pubDER, err := x509.MarshalPKIXPublicKey(&priv.PublicKey)
	if err != nil {
		t.Fatalf("marshal pubkey: %v", err)
	}
	key, err := selectKeyForAlg("RS256", pubDER)
	if err != nil {
		t.Fatalf("expected RSA key parse: %v", err)
	}
	if _, ok := key.(*rsa.PublicKey); !ok {
		t.Fatalf("expected RSA public key, got %T", key)
	}

	privDER := x509.MarshalPKCS1PrivateKey(priv)
	pemBytes := pem.EncodeToMemory(&pem.Block{Type: "RSA PRIVATE KEY", Bytes: privDER})
	key, err = selectKeyForAlg("PS256", pemBytes)
	if err != nil {
		t.Fatalf("expected RSA private key parse: %v", err)
	}
	if _, ok := key.(*rsa.PublicKey); !ok {
		t.Fatalf("expected RSA public key from private pem, got %T", key)
	}
}

func TestSelectKeyForAlg_ECDSA(t *testing.T) {
	priv, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatalf("failed to generate ECDSA key: %v", err)
	}
	ecDER, err := x509.MarshalPKIXPublicKey(&priv.PublicKey)
	if err != nil {
		t.Fatalf("marshal ec pubkey: %v", err)
	}
	key, err := selectKeyForAlg("ES256", ecDER)
	if err != nil {
		t.Fatalf("select key for es256 der: %v", err)
	}
	if _, ok := key.(*ecdsa.PublicKey); !ok {
		t.Fatalf("expected ECDSA public key, got %T", key)
	}

	secDER, err := x509.MarshalECPrivateKey(priv)
	if err != nil {
		t.Fatalf("marshal ec private: %v", err)
	}
	pemBytes := pem.EncodeToMemory(&pem.Block{Type: "EC PRIVATE KEY", Bytes: secDER})
	key, err = selectKeyForAlg("ES256", pemBytes)
	if err != nil {
		t.Fatalf("select key for es256 pem: %v", err)
	}
	if _, ok := key.(*ecdsa.PublicKey); !ok {
		t.Fatalf("expected ECDSA public key from pem, got %T", key)
	}
}

func TestSelectKeyForAlg_Ed25519(t *testing.T) {
	pub, priv, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatalf("failed to generate ed25519: %v", err)
	}
	pubDER, err := x509.MarshalPKIXPublicKey(pub)
	if err != nil {
		t.Fatalf("marshal ed pub: %v", err)
	}
	key, err := selectKeyForAlg("EdDSA", pubDER)
	if err != nil {
		t.Fatalf("select key for eddsa der: %v", err)
	}
	if _, ok := key.(ed25519.PublicKey); !ok {
		t.Fatalf("expected ed25519 public key, got %T", key)
	}

	privDER, err := x509.MarshalPKCS8PrivateKey(priv)
	if err != nil {
		t.Fatalf("marshal pkcs8: %v", err)
	}
	pemBytes := pem.EncodeToMemory(&pem.Block{Type: "PRIVATE KEY", Bytes: privDER})
	key, err = selectKeyForAlg("EdDSA", pemBytes)
	if err != nil {
		t.Fatalf("select key for eddsa pem: %v", err)
	}
	if _, ok := key.(ed25519.PublicKey); !ok {
		t.Fatalf("expected ed25519 public key from pem, got %T", key)
	}
}

func TestSelectKeyForAlg_HS(t *testing.T) {
	keyBytes := []byte("shared")
	key, err := selectKeyForAlg("HS256", keyBytes)
	if err != nil {
		t.Fatalf("select key for hs256: %v", err)
	}
	if !bytes.Equal(key.([]byte), keyBytes) {
		t.Fatalf("hs key mismatch")
	}
}

func TestSelectKeyForAlg_Unsupported(t *testing.T) {
	if _, err := selectKeyForAlg("XYZ", []byte("key")); err == nil {
		t.Fatal("expected unsupported alg error")
	}
}

func TestParseRSAPEMCases(t *testing.T) {
	priv, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("failed to generate RSA key: %v", err)
	}

	publicDER, err := x509.MarshalPKIXPublicKey(&priv.PublicKey)
	if err != nil {
		t.Fatalf("marshal pubkey: %v", err)
	}
	if _, err := parseRSAPEM(pem.EncodeToMemory(&pem.Block{Type: "PUBLIC KEY", Bytes: publicDER})); err != nil {
		t.Fatalf("parse public key pem: %v", err)
	}

	if _, err := parseRSAPEM(pem.EncodeToMemory(&pem.Block{Type: "RSA PUBLIC KEY", Bytes: x509.MarshalPKCS1PublicKey(&priv.PublicKey)})); err != nil {
		t.Fatalf("parse rsa public key: %v", err)
	}

	certDER := mustCreateCertificate(t, &priv.PublicKey, priv)
	if _, err := parseRSAPEM(pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: certDER})); err != nil {
		t.Fatalf("parse cert pem: %v", err)
	}

	pkcs8, err := x509.MarshalPKCS8PrivateKey(priv)
	if err != nil {
		t.Fatalf("marshal pkcs8: %v", err)
	}
	if _, err := parseRSAPEM(pem.EncodeToMemory(&pem.Block{Type: "PRIVATE KEY", Bytes: pkcs8})); err != nil {
		t.Fatalf("parse pkcs8 pem: %v", err)
	}

	if _, err := parseRSAPEM(pem.EncodeToMemory(&pem.Block{Type: "RSA PRIVATE KEY", Bytes: x509.MarshalPKCS1PrivateKey(priv)})); err != nil {
		t.Fatalf("parse rsa private key pem: %v", err)
	}
}

func TestParseRSADERCases(t *testing.T) {
	priv, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("failed to generate RSA key: %v", err)
	}

	if _, err := parseRSADER(x509.MarshalPKCS1PublicKey(&priv.PublicKey)); err != nil {
		t.Fatalf("parse pkcs1 public der: %v", err)
	}

	pkixDER, err := x509.MarshalPKIXPublicKey(&priv.PublicKey)
	if err != nil {
		t.Fatalf("marshal pkix public: %v", err)
	}
	if _, err := parseRSADER(pkixDER); err != nil {
		t.Fatalf("parse pkix public der: %v", err)
	}

	certDER := mustCreateCertificate(t, &priv.PublicKey, priv)
	if _, err := parseRSADER(certDER); err != nil {
		t.Fatalf("parse cert der: %v", err)
	}

	pkcs8, err := x509.MarshalPKCS8PrivateKey(priv)
	if err != nil {
		t.Fatalf("marshal pkcs8: %v", err)
	}
	if _, err := parseRSADER(pkcs8); err != nil {
		t.Fatalf("parse pkcs8 der: %v", err)
	}

	if _, err := parseRSADER(x509.MarshalPKCS1PrivateKey(priv)); err != nil {
		t.Fatalf("parse pkcs1 private der: %v", err)
	}
}

func TestParseECDSAPEMCases(t *testing.T) {
	priv, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatalf("failed to generate ECDSA key: %v", err)
	}

	pubDER, err := x509.MarshalPKIXPublicKey(&priv.PublicKey)
	if err != nil {
		t.Fatalf("marshal ec pub: %v", err)
	}
	if _, err := parseECDSAPEM(pem.EncodeToMemory(&pem.Block{Type: "PUBLIC KEY", Bytes: pubDER})); err != nil {
		t.Fatalf("parse ec public pem: %v", err)
	}

	certDER := mustCreateCertificate(t, &priv.PublicKey, priv)
	if _, err := parseECDSAPEM(pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: certDER})); err != nil {
		t.Fatalf("parse ec cert pem: %v", err)
	}

	ecPrivDER, err := x509.MarshalECPrivateKey(priv)
	if err != nil {
		t.Fatalf("marshal ec priv: %v", err)
	}
	if _, err := parseECDSAPEM(pem.EncodeToMemory(&pem.Block{Type: "EC PRIVATE KEY", Bytes: ecPrivDER})); err != nil {
		t.Fatalf("parse ec private pem: %v", err)
	}

	pkcs8, err := x509.MarshalPKCS8PrivateKey(priv)
	if err != nil {
		t.Fatalf("marshal pkcs8: %v", err)
	}
	if _, err := parseECDSAPEM(pem.EncodeToMemory(&pem.Block{Type: "PRIVATE KEY", Bytes: pkcs8})); err != nil {
		t.Fatalf("parse ec pkcs8 pem: %v", err)
	}
}

func TestParseECDSADERCases(t *testing.T) {
	priv, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatalf("failed to generate ECDSA key: %v", err)
	}

	pkixDER, err := x509.MarshalPKIXPublicKey(&priv.PublicKey)
	if err != nil {
		t.Fatalf("marshal ec pkix: %v", err)
	}
	if _, err := parseECDSADER(pkixDER); err != nil {
		t.Fatalf("parse ec pkix der: %v", err)
	}

	certDER := mustCreateCertificate(t, &priv.PublicKey, priv)
	if _, err := parseECDSADER(certDER); err != nil {
		t.Fatalf("parse ec cert der: %v", err)
	}

	pkcs8, err := x509.MarshalPKCS8PrivateKey(priv)
	if err != nil {
		t.Fatalf("marshal pkcs8: %v", err)
	}
	if _, err := parseECDSADER(pkcs8); err != nil {
		t.Fatalf("parse ec pkcs8 der: %v", err)
	}

	ecPrivDER, err := x509.MarshalECPrivateKey(priv)
	if err != nil {
		t.Fatalf("marshal ec priv: %v", err)
	}
	if _, err := parseECDSADER(ecPrivDER); err != nil {
		t.Fatalf("parse ec private der: %v", err)
	}
}

func TestParseEd25519PEMCases(t *testing.T) {
	pub, priv, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatalf("failed to generate ed25519: %v", err)
	}

	pubDER, err := x509.MarshalPKIXPublicKey(pub)
	if err != nil {
		t.Fatalf("marshal ed pub: %v", err)
	}
	if _, err := parseEd25519PEM(pem.EncodeToMemory(&pem.Block{Type: "PUBLIC KEY", Bytes: pubDER})); err != nil {
		t.Fatalf("parse ed pub pem: %v", err)
	}

	certDER := mustCreateCertificate(t, pub, priv)
	if _, err := parseEd25519PEM(pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: certDER})); err != nil {
		t.Fatalf("parse ed cert pem: %v", err)
	}

	pkcs8, err := x509.MarshalPKCS8PrivateKey(priv)
	if err != nil {
		t.Fatalf("marshal ed pkcs8: %v", err)
	}
	if _, err := parseEd25519PEM(pem.EncodeToMemory(&pem.Block{Type: "PRIVATE KEY", Bytes: pkcs8})); err != nil {
		t.Fatalf("parse ed pkcs8 pem: %v", err)
	}
}

func TestParseEd25519DERCases(t *testing.T) {
	pub, priv, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatalf("failed to generate ed25519: %v", err)
	}

	pubDER, err := x509.MarshalPKIXPublicKey(pub)
	if err != nil {
		t.Fatalf("marshal ed pub: %v", err)
	}
	if _, err := parseEd25519DER(pubDER); err != nil {
		t.Fatalf("parse ed pub der: %v", err)
	}

	certDER := mustCreateCertificate(t, pub, priv)
	if _, err := parseEd25519DER(certDER); err != nil {
		t.Fatalf("parse ed cert der: %v", err)
	}

	pkcs8, err := x509.MarshalPKCS8PrivateKey(priv)
	if err != nil {
		t.Fatalf("marshal ed pkcs8: %v", err)
	}
	if _, err := parseEd25519DER(pkcs8); err != nil {
		t.Fatalf("parse ed pkcs8 der: %v", err)
	}
}

func TestParseRSAPEMErrorPaths(t *testing.T) {
	if _, err := parseRSAPEM([]byte("not pem")); err == nil {
		t.Fatal("expected not pem error")
	}

	if _, err := parseRSAPEM(pem.EncodeToMemory(&pem.Block{Type: "PUBLIC KEY", Bytes: []byte("bad")})); err == nil {
		t.Fatal("expected public key parse error")
	}

	if _, err := parseRSAPEM(pem.EncodeToMemory(&pem.Block{Type: "RSA PUBLIC KEY", Bytes: []byte("bad")})); err == nil {
		t.Fatal("expected rsa public key parse error")
	}

	if _, err := parseRSAPEM(pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: []byte("bad")})); err == nil {
		t.Fatal("expected cert parse error")
	}

	if _, err := parseRSAPEM(pem.EncodeToMemory(&pem.Block{Type: "PRIVATE KEY", Bytes: []byte("bad")})); err == nil {
		t.Fatal("expected private key parse error")
	}

	if _, err := parseRSAPEM(pem.EncodeToMemory(&pem.Block{Type: "RSA PRIVATE KEY", Bytes: []byte("bad")})); err == nil {
		t.Fatal("expected rsa private key parse error")
	}

	if _, err := parseRSAPEM(pem.EncodeToMemory(&pem.Block{Type: "UNKNOWN", Bytes: []byte("bad")})); err == nil {
		t.Fatal("expected unknown type error")
	}
}

func TestParseRSADERErrorPath(t *testing.T) {
	if _, err := parseRSADER([]byte("bad")); err == nil {
		t.Fatal("expected rsa der parse error")
	}
}

func TestParseECDSAPEMErrorPaths(t *testing.T) {
	if _, err := parseECDSAPEM([]byte("not pem")); err == nil {
		t.Fatal("expected not pem error")
	}

	if _, err := parseECDSAPEM(pem.EncodeToMemory(&pem.Block{Type: "PUBLIC KEY", Bytes: []byte("bad")})); err == nil {
		t.Fatal("expected ec public parse error")
	}

	if _, err := parseECDSAPEM(pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: []byte("bad")})); err == nil {
		t.Fatal("expected ec cert parse error")
	}

	if _, err := parseECDSAPEM(pem.EncodeToMemory(&pem.Block{Type: "EC PRIVATE KEY", Bytes: []byte("bad")})); err == nil {
		t.Fatal("expected ec private parse error")
	}

	if _, err := parseECDSAPEM(pem.EncodeToMemory(&pem.Block{Type: "PRIVATE KEY", Bytes: []byte("bad")})); err == nil {
		t.Fatal("expected ec pkcs8 parse error")
	}

	if _, err := parseECDSAPEM(pem.EncodeToMemory(&pem.Block{Type: "UNKNOWN", Bytes: []byte("bad")})); err == nil {
		t.Fatal("expected unknown type error")
	}
}

func TestParseECDSADERErrorPath(t *testing.T) {
	if _, err := parseECDSADER([]byte("bad")); err == nil {
		t.Fatal("expected ec der parse error")
	}
}

func TestParseEd25519PEMErrorPaths(t *testing.T) {
	if _, err := parseEd25519PEM([]byte("not pem")); err == nil {
		t.Fatal("expected not pem error")
	}

	if _, err := parseEd25519PEM(pem.EncodeToMemory(&pem.Block{Type: "PUBLIC KEY", Bytes: []byte("bad")})); err == nil {
		t.Fatal("expected ed pub parse error")
	}

	if _, err := parseEd25519PEM(pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: []byte("bad")})); err == nil {
		t.Fatal("expected ed cert parse error")
	}

	if _, err := parseEd25519PEM(pem.EncodeToMemory(&pem.Block{Type: "PRIVATE KEY", Bytes: []byte("bad")})); err == nil {
		t.Fatal("expected ed private parse error")
	}

	if _, err := parseEd25519PEM(pem.EncodeToMemory(&pem.Block{Type: "UNKNOWN", Bytes: []byte("bad")})); err == nil {
		t.Fatal("expected unknown type error")
	}
}

func TestParseEd25519DERErrorPath(t *testing.T) {
	if _, err := parseEd25519DER([]byte("bad")); err == nil {
		t.Fatal("expected ed der parse error")
	}
}

func generateHS256Token(t *testing.T, secret []byte, claims jwt.MapClaims) string {
	t.Helper()
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString(secret)
	if err != nil {
		t.Fatalf("failed to sign HS256 token: %v", err)
	}
	return signed
}

func encodeRSAPublicPEM(t *testing.T, pub *rsa.PublicKey) []byte {
	t.Helper()
	der, err := x509.MarshalPKIXPublicKey(pub)
	if err != nil {
		t.Fatalf("failed to marshal public key: %v", err)
	}
	var buf bytes.Buffer
	if err := pem.Encode(&buf, &pem.Block{Type: "PUBLIC KEY", Bytes: der}); err != nil {
		t.Fatalf("failed to encode PEM: %v", err)
	}
	return buf.Bytes()
}

func makeManualToken(header, claims map[string]any, sig string) string {
	h, _ := json.Marshal(header)
	c, _ := json.Marshal(claims)
	return fmt.Sprintf("%s.%s.%s",
		base64.RawURLEncoding.EncodeToString(h),
		base64.RawURLEncoding.EncodeToString(c),
		base64.RawURLEncoding.EncodeToString([]byte(sig)),
	)
}

func mustCreateCertificate(t *testing.T, pub interface{}, priv interface{}) []byte {
	t.Helper()
	template := &x509.Certificate{
		SerialNumber: big.NewInt(1),
		NotBefore:    time.Now().Add(-time.Minute),
		NotAfter:     time.Now().Add(time.Hour),
		KeyUsage:     x509.KeyUsageDigitalSignature,
	}
	certDER, err := x509.CreateCertificate(rand.Reader, template, template, pub, priv)
	if err != nil {
		t.Fatalf("failed to create certificate: %v", err)
	}
	return certDER
}
