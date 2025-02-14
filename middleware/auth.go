package middleware

import (
	"fmt"
	"os"
	"strings"

	"github.com/dgrijalva/jwt-go"
	"github.com/gofiber/fiber/v2"
)

func AuthMiddleware(roles ...string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		// Ambil token dari header
		authHeader := c.Get("Authorization")
		if authHeader == "" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "Token autentikasi tidak ditemukan",
			})
		}

		// Pastikan format Bearer token benar
		tokenParts := strings.Split(authHeader, " ")
		if len(tokenParts) != 2 || tokenParts[0] != "Bearer" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "Format token tidak valid",
			})
		}

		tokenString := tokenParts[1]

		// Parsing token
		token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
			// Validasi method signing
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
			}
			// Kembalikan secret key dari env
			secretKey := os.Getenv("JWT_SECRET_KEY")
			if secretKey == "" {
				return nil, fmt.Errorf("JWT_SECRET_KEY tidak ditemukan")
			}
			return []byte(secretKey), nil
		})

		if err != nil {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": fmt.Sprintf("Token tidak valid: %v", err),
			})
		}

		// Periksa klaim (claims) token dan role yang sesuai
		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok || !token.Valid {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "Token claims tidak valid",
			})
		}

		// Validasi role
		userRole, ok := claims["role"].(string)
		if !ok {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "Role tidak ditemukan dalam token",
			})
		}

		// Cek apakah role yang diminta sesuai
		if len(roles) > 0 {
			hasRole := false
			for _, role := range roles {
				if userRole == role {
					hasRole = true
					break
				}
			}
			if !hasRole {
				return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
					"error": "Anda tidak memiliki akses untuk melakukan operasi ini",
				})
			}
		}

		// Simpan claims ke locals untuk digunakan di handler
		c.Locals("claims", claims)
		c.Locals("username", claims["username"])
		c.Locals("role", userRole)

		return c.Next()
	}
}
