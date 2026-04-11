package app

import (
	"errors"

	jwt "github.com/golang-jwt/jwt/v5"
)

const (
	codeEmptyToken                  = "empty_token"
	codeTokenMustHave3Parts         = "token_must_have_3_parts"
	codeParseUnverified             = "parse_unverified"
	codeNoKeyWarning                = "no_key_warning"
	codeMissingAlgHeader            = "missing_alg_header"
	codeUnsupportedAlg              = "unsupported_alg"
	codeAlgMismatch                 = "alg_mismatch"
	codeTokenMalformed              = "token_malformed"
	codeTokenSignatureInvalid       = "token_signature_invalid"
	codeTokenUnverifiable           = "token_unverifiable"
	codeTokenExpired                = "token_expired"
	codeTokenNotValidYet            = "token_not_valid_yet"
	codeTokenUsedBeforeIssued       = "token_used_before_issued"
	codeRequiredClaimMissing        = "required_claim_missing"
	codeInvalidAudience             = "invalid_audience"
	codeInvalidIssuer               = "invalid_issuer"
	codeInvalidSubject              = "invalid_subject"
	codeInvalidClaims               = "invalid_claims"
	codeRSAKeyParseFailed           = "rsa_key_parse_failed"
	codeRSAPEMBlockParseFailed      = "rsa_pem_block_parse_failed"
	codeRSANotPublicKey             = "rsa_not_public_key"
	codeRSACertMissingPublicKey     = "rsa_cert_missing_public_key"
	codeRSAPKCS8NotRSA              = "rsa_pkcs8_not_rsa"
	codeRSAUnknownPEMType           = "rsa_unknown_pem_type"
	codeRSADERUnparseable           = "rsa_der_unparseable"
	codeECDSAKeyParseFailed         = "ecdsa_key_parse_failed"
	codeECDSAPEMBlockParseFailed    = "ecdsa_pem_block_parse_failed"
	codeECDSANotPublicKey           = "ecdsa_not_public_key"
	codeECDSACertMissingPublicKey   = "ecdsa_cert_missing_public_key"
	codeECDSAPKCS8NotECDSA          = "ecdsa_pkcs8_not_ecdsa"
	codeECDSAUnknownPEMType         = "ecdsa_unknown_pem_type"
	codeECDSADERUnparseable         = "ecdsa_der_unparseable"
	codeEd25519KeyParseFailed       = "ed25519_key_parse_failed"
	codeEd25519PEMBlockParseFailed  = "ed25519_pem_block_parse_failed"
	codeEd25519NotPublicKey         = "ed25519_not_public_key"
	codeEd25519CertMissingPublicKey = "ed25519_cert_missing_public_key"
	codeEd25519PKCS8NotEd25519      = "ed25519_pkcs8_not_ed25519"
	codeEd25519UnknownPEMType       = "ed25519_unknown_pem_type"
	codeEd25519DERUnparseable       = "ed25519_der_unparseable"
)

func backendError(code string) error {
	return errors.New(code)
}

func codeForJWTError(err error) string {
	switch {
	case err == nil:
		return ""
	case errors.Is(err, jwt.ErrTokenMalformed):
		return codeTokenMalformed
	case errors.Is(err, jwt.ErrTokenSignatureInvalid):
		return codeTokenSignatureInvalid
	case errors.Is(err, jwt.ErrTokenExpired):
		return codeTokenExpired
	case errors.Is(err, jwt.ErrTokenNotValidYet):
		return codeTokenNotValidYet
	case errors.Is(err, jwt.ErrTokenUsedBeforeIssued):
		return codeTokenUsedBeforeIssued
	case errors.Is(err, jwt.ErrTokenRequiredClaimMissing):
		return codeRequiredClaimMissing
	case errors.Is(err, jwt.ErrTokenInvalidAudience):
		return codeInvalidAudience
	case errors.Is(err, jwt.ErrTokenInvalidIssuer):
		return codeInvalidIssuer
	case errors.Is(err, jwt.ErrTokenInvalidSubject):
		return codeInvalidSubject
	case errors.Is(err, jwt.ErrTokenInvalidClaims):
		return codeInvalidClaims
	case errors.Is(err, jwt.ErrTokenUnverifiable):
		return codeTokenUnverifiable
	default:
		return err.Error()
	}
}
