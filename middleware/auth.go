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
		tokenString := c.Get("Authorization")
		tokenString = strings.TrimPrefix(tokenString, "Bearer ")

		if tokenString == "" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"message": "No token provided",
			})
		}

		// Parsing token
		token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
			// Validasi method signing
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
			}
			// Kembalikan secret key dari env
			secretKey := os.Getenv("JWT_SECRET_KEY")
			return []byte(secretKey), nil
		})
		if err != nil {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"message": "Invalid token",
				"error":   err.Error(),
			})
		}

		// Periksa klaim (claims) token dan role yang sesuai
		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok || !token.Valid {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"message": "Invalid token claims",
			})
		}

		// Simpan claims ke locals untuk digunakan di handler
		c.Locals("claims", claims)
		c.Locals("username", claims["username"])

		// Cek apakah role yang diminta sesuai
		userRole, ok := claims["role"].(string)
		if !ok {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"message": "Invalid role claim",
			})
		}

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
					"message": "Forbidden: insufficient role",
				})
			}
		}

		return c.Next()
	}
}
