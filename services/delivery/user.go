package delivery

import (
	"SIE-SRC/domain"
	"SIE-SRC/middleware"
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"strconv"
	"time"

	"github.com/dgrijalva/jwt-go"
	"github.com/gofiber/fiber/v2"
)

var loginData struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type Claims struct {
	Username string `json:"username"`
	Role     string `json:"role"`
}

type HttpDeliveryUser struct {
	HTTP domain.UserUseCase
}

func NewHttpDeliveryUser(app fiber.Router, HTTP domain.UserUseCase) {
	handler := HttpDeliveryUser{
		HTTP: HTTP,
	}

	// Routes publik
	public := app.Group("/user")
	public.Post("/login", handler.LoginUser)
	public.Post("/register", handler.RegisterFirstAdmin)
	public.Get("/getall", handler.GetAll) // Endpoint untuk register admin pertama

	// Routes khusus admin dengan middleware auth
	adminOnly := app.Group("/user/admin")
	adminOnly.Use(middleware.AuthMiddleware("admin"))
	adminOnly.Post("/register", handler.RegisterUser)
	adminOnly.Put("/update/:username", handler.UpdateUser)
	adminOnly.Delete("/delete-user/:id_user", handler.DeleteUser)
}

func (d *HttpDeliveryUser) RegisterUser(c *fiber.Ctx) error {
	// Parse data dari body request
	var user domain.User
	if err := c.BodyParser(&user); err != nil {
		log.Printf("Error saat parsing data registrasi: %v", err)
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"error": "Format request tidak valid",
		})
	}

	// Validasi token dari pengguna
	claims := c.Locals("claims")
	if claims == nil {
		return c.Status(http.StatusUnauthorized).JSON(fiber.Map{
			"error": "Token autentikasi tidak ditemukan",
		})
	}

	// Cast claims ke jwt.MapClaims
	mapClaims, ok := claims.(jwt.MapClaims)
	if !ok {
		return c.Status(http.StatusUnauthorized).JSON(fiber.Map{
			"error": "Format token tidak valid",
		})
	}

	// Validasi role pengguna
	userRole, ok := mapClaims["role"].(string)
	if !ok {
		return c.Status(http.StatusUnauthorized).JSON(fiber.Map{
			"error": "Klaim role dalam token tidak valid",
		})
	}

	// Pastikan pengguna adalah admin
	if userRole != "admin" {
		return c.Status(http.StatusForbidden).JSON(fiber.Map{
			"error": "Hanya admin yang dapat mendaftarkan pengguna baru",
		})
	}

	// Validasi data pengguna yang akan didaftarkan
	if user.Username == "" || user.Password == "" || user.Role == "" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"error": "Username, password, dan role harus diisi",
		})
	}

	// Validasi role yang diperbolehkan
	validRole := false
	allowedRoles := []string{"admin", "owner"}
	for _, role := range allowedRoles {
		if user.Role == role {
			validRole = true
			break
		}
	}

	if !validRole {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"error": "Role tidak valid. Role yang diperbolehkan adalah: admin, owner",
		})
	}

	// Log informasi admin yang melakukan registrasi
	adminUsername, _ := mapClaims["username"].(string)
	log.Printf("Admin %s mencoba mendaftarkan user baru: %s dengan role %s", 
		adminUsername, user.Username, user.Role)

	// Daftarkan pengguna baru
	registeredUser, err := d.HTTP.RegisterUser(context.Background(), &user)
	if err != nil {
		log.Printf("Gagal mendaftarkan pengguna: %v", err)
		if err.Error() == fmt.Sprintf("username %s sudah digunakan", user.Username) {
			return c.Status(http.StatusConflict).JSON(fiber.Map{
				"error": err.Error(),
				"data" : registeredUser,
			})
		}
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"error": fmt.Sprintf("Gagal mendaftarkan pengguna: %v", err),
		})
	}

	log.Printf("Pengguna baru berhasil didaftarkan: %s dengan role: %s", user.Username, user.Role)

	return c.Status(http.StatusCreated).JSON(fiber.Map{
		"success": true,
		"message": "Pengguna berhasil didaftarkan",
		"data": fiber.Map{
			"username": user.Username,
			"role": user.Role,
		},
	})
}

// Mengautentikasi user login
func (d *HttpDeliveryUser) LoginUser(c *fiber.Ctx) error {
	// Parse data dari body request
	if err := c.BodyParser(&loginData); err != nil {
		log.Printf("Error saat parsing data login: %v", err)
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"error": "Format request tidak valid",
		})
	}

	// Validasi field yang diperlukan
	if loginData.Username == "" || loginData.Password == "" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"error": "Username dan password harus diisi",
		})
	}

	// Catat percobaan login
	log.Printf("Percobaan login untuk username: %s", loginData.Username)

	// Autentikasi pengguna
	user, err := d.HTTP.AuthenticateUser(context.Background(), loginData.Username, loginData.Password)
	if err != nil || user == nil {
		log.Printf("Autentikasi gagal untuk pengguna %s: %v", loginData.Username, err)
		return c.Status(http.StatusUnauthorized).JSON(fiber.Map{
			"error": "Username atau password tidak valid",
		})
	}

	// Generate token JWT
	token, err := GenerateToken(user.Username, user.Role)
	if err != nil {
		log.Printf("Gagal generate token untuk pengguna %s: %v", user.Username, err)
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"error": "Gagal membuat token autentikasi",
		})
	}

	log.Printf("Login berhasil untuk pengguna: %s dengan role: %s", user.Username, user.Role)

	// Kirim response sukses dengan token
	return c.Status(http.StatusOK).JSON(fiber.Map{
		"success": true,
		"message": "Login berhasil",
		"data": fiber.Map{
			"user": fiber.Map{
				"username": user.Username,
				"role":     user.Role,
			},
			"token": token,
		},
	})
}

// Mencari user berdasarkan username
func (d *HttpDeliveryUser) GetUserByUsername(c *fiber.Ctx) error {
	id := c.Params("username")

	user, err := d.HTTP.GetUserByUsername(context.Background(), id)
	if err != nil {
		return c.Status(http.StatusNotFound).JSON(fiber.Map{
			"error": "Pengguna tidak ditemukan",
		})
	}

	return c.Status(http.StatusOK).JSON(user)
}

func (d *HttpDeliveryUser) GetAll(c *fiber.Ctx) error {
	users, err := d.HTTP.GetAll(context.Background())
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"error": fmt.Sprintf("Gagal mendapatkan pengguna: %v", err),
		})
	}

	return c.Status(http.StatusOK).JSON(fiber.Map{
		"data": users,
	})
}

// DeleteUser handles deleting a user by ID.
func (d *HttpDeliveryUser) DeleteUser(c *fiber.Ctx) error {
	id := c.Params("id_user")

	err := d.HTTP.DeleteUser(context.Background(), id)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"error": "Gagal menghapus pengguna",
		})
	}

	return c.Status(http.StatusOK).JSON(fiber.Map{
		"message": "Pengguna berhasil dihapus",
	})
}

// UpdateUser handles updating a user by username
func (d *HttpDeliveryUser) UpdateUser(c *fiber.Ctx) error {
	username := c.Params("username")
	if username == "" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"error": "Username harus diisi",
		})
	}

	var updateData domain.User
	if err := c.BodyParser(&updateData); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"error": "Format request tidak valid",
		})
	}

	// Validasi role dari token
	claims := c.Locals("claims").(jwt.MapClaims)
	userRole := claims["role"].(string)

	if userRole != "admin" {
		return c.Status(http.StatusForbidden).JSON(fiber.Map{
			"error": "Hanya admin yang dapat mengupdate pengguna",
		})
	}

	// Validasi data update
	if updateData.Role != "" {
		allowedRoles := []string{"admin", "owner"}
		validRole := false
		for _, role := range allowedRoles {
			if updateData.Role == role {
				validRole = true
				break
			}
		}

		if !validRole {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{
				"error": "Role tidak valid. Role yang diperbolehkan adalah: admin, owner",
			})
		}
	}

	err := d.HTTP.UpdateUser(context.Background(), username, &updateData)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"error": fmt.Sprintf("Gagal mengupdate pengguna: %v", err),
		})
	}

	return c.Status(http.StatusOK).JSON(fiber.Map{
		"message": "Pengguna berhasil diupdate",
	})
}

// RegisterFirstAdmin untuk mendaftarkan admin pertama tanpa autentikasi
func (d *HttpDeliveryUser) RegisterFirstAdmin(c *fiber.Ctx) error {
	var user domain.User
	if err := c.BodyParser(&user); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"error": "Format request tidak valid",
		})
	}

	// Hanya izinkan registrasi admin
	user.Role = "admin"

	// Validasi data user
	if user.Username == "" || user.Password == "" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"error": "Username dan password harus diisi",
		})
	}

	// Cek apakah sudah ada admin
	_, err := d.HTTP.GetAll(context.Background())
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"error": fmt.Sprintf("Gagal mendapatkan pengguna: %v", err),
		})
	}

	registeredUser, err := d.HTTP.RegisterUser(context.Background(), &user)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"error": fmt.Sprintf("Gagal mendaftarkan pengguna: %v", err),
		})
	}

	return c.Status(http.StatusCreated).JSON(fiber.Map{
		"message": "Admin berhasil didaftarkan",
		"data":    registeredUser,
	})
}

func GenerateToken(username, role string) (string, error) {
	secretKey := os.Getenv("JWT_SECRET_KEY")
	expirationHours := os.Getenv("JWT_EXPIRATION_HOURS")

	// Parsing expiration hours menjadi integer
	expiration, err := strconv.Atoi(expirationHours)
	if err != nil {
		log.Printf("Error parsing expiration hours: %v", err) // Log jika parsing gagal
		return "", fmt.Errorf("jam kadaluarsa tidak valid: %v", err)
	}

	expirationTime := time.Now().Add(time.Hour * time.Duration(expiration))

	// Membuat token JWT
	claims := jwt.MapClaims{
		"username": username,
		"role":     role,
		"exp":      expirationTime.Unix(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)

	// Tanda tangani token dengan secret key
	tokenString, err := token.SignedString([]byte(secretKey))
	if err != nil {
		log.Printf("Error signing token for user %s: %v", username, err) // Log kesalahan saat signing
		return "", fmt.Errorf("gagal membuat token: %v", err)
	}

	log.Printf("Token berhasil dibuat untuk pengguna %s", username) // Log saat token berhasil dibuat
	return tokenString, nil
}
