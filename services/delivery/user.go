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
	public.Post("/register", handler.RegisterFirstAdmin) // Endpoint untuk register admin pertama

	// Routes yang membutuhkan authentication
	protected := app.Group("/user")
	protected.Use(middleware.AuthMiddleware("admin", "owner"))
	protected.Get("/by-username/:username", handler.GetUserByUsername)
	protected.Get("/getall", handler.GetAll)

	// Routes khusus admin
	adminOnly := app.Group("/user/admin")
	adminOnly.Use(middleware.AuthMiddleware("admin"))
	adminOnly.Post("/register", handler.RegisterUser)
	adminOnly.Put("/update/:username", handler.UpdateUser)
	adminOnly.Delete("/delete-user/:id", handler.DeleteUser)
}

func (d *HttpDeliveryUser) RegisterUser(c *fiber.Ctx) error {
	var user domain.User
	if err := c.BodyParser(&user); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request body",
		})
	}

	// Validasi role dari token
	tokenUser := c.Locals("user").(*jwt.Token)
	claims := tokenUser.Claims.(jwt.MapClaims)
	userRole := claims["role"].(string)

	if userRole != "admin" {
		return c.Status(http.StatusForbidden).JSON(fiber.Map{
			"error": "Only admin can register new users",
		})
	}

	// Tambahkan validasi data user
	if user.Username == "" || user.Password == "" || user.Role == "" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"error": "Username, password, and role are required",
		})
	}

	// Validasi role yang diperbolehkan
	allowedRoles := []string{"admin", "owner"}
	validRole := false
	for _, role := range allowedRoles {
		if user.Role == role {
			validRole = true
			break
		}
	}

	if !validRole {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid role. Allowed roles are: admin, owner",
		})
	}

	registeredUser, err := d.HTTP.RegisterUser(context.Background(), &user)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"error": fmt.Sprintf("Failed to register user: %v", err),
		})
	}

	return c.Status(http.StatusCreated).JSON(fiber.Map{
		"message": "User registered successfully",
		"data":    registeredUser,
	})
}

// Mengautentikasi user login
func (d *HttpDeliveryUser) LoginUser(c *fiber.Ctx) error {
	// Parsing data body yang dikirim
	if err := c.BodyParser(&loginData); err != nil {
		log.Printf("Error parsing login data for user %s: %v", loginData.Username, err)
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid input",
		})
	}

	// Log request data untuk login
	log.Printf("Login attempt for username: %s", loginData.Username)

	// Melakukan autentikasi user
	user, err := d.HTTP.AuthenticateUser(context.Background(), loginData.Username, loginData.Password)
	if err != nil || user == nil { // Pastikan user tidak nil
		return c.Status(http.StatusUnauthorized).JSON(fiber.Map{
			"error": "username atau password tidak valid",
		})
	}

	// Generate token JWT
	token, err := GenerateToken(user.Username, user.Role)
	if err != nil {
		log.Printf("Failed to generate token for user %s: %v", user.Username, err)
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"error": "gagal membuat token",
		})
	}

	log.Printf("Login successful for username: %s", user.Username)

	return c.Status(http.StatusOK).JSON(fiber.Map{
		"user":  user,
		"token": token,
		"role":  user.Role,
	})
}

// Mencari user berdasarkan username
func (d *HttpDeliveryUser) GetUserByUsername(c *fiber.Ctx) error {
	id := c.Params("username")

	user, err := d.HTTP.GetUserByUsername(context.Background(), id)
	if err != nil {
		return c.Status(http.StatusNotFound).JSON(fiber.Map{
			"error": "user tidak ditemukan",
		})
	}

	return c.Status(http.StatusOK).JSON(user)
}

func (d *HttpDeliveryUser) GetAll(c *fiber.Ctx) error {
	users, err := d.HTTP.GetAll(context.Background())
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"error": fmt.Sprintf("Failed to get users: %v", err),
		})
	}

	return c.Status(http.StatusOK).JSON(fiber.Map{
		"data": users,
	})
}

// DeleteUser handles deleting a user by ID.
func (d *HttpDeliveryUser) DeleteUser(c *fiber.Ctx) error {
	id := c.Params("id")

	err := d.HTTP.DeleteUser(context.Background(), id)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"error": "gagal menghapus user",
		})
	}

	return c.Status(http.StatusOK).JSON(fiber.Map{
		"message": "user berhasil dihapus",
	})
}

// UpdateUser handles updating a user by username
func (d *HttpDeliveryUser) UpdateUser(c *fiber.Ctx) error {
	username := c.Params("username")
	if username == "" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"error": "username is required",
		})
	}

	var updateData domain.User
	if err := c.BodyParser(&updateData); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request body",
		})
	}

	// Validasi role dari token
	tokenUser := c.Locals("user").(*jwt.Token)
	claims := tokenUser.Claims.(jwt.MapClaims)
	userRole := claims["role"].(string)

	if userRole != "admin" {
		return c.Status(http.StatusForbidden).JSON(fiber.Map{
			"error": "Only admin can update users",
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
				"error": "Invalid role. Allowed roles are: admin, owner",
			})
		}
	}

	err := d.HTTP.UpdateUser(context.Background(), username, &updateData)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"error": fmt.Sprintf("Failed to update user: %v", err),
		})
	}

	return c.Status(http.StatusOK).JSON(fiber.Map{
		"message": "User updated successfully",
	})
}

// RegisterFirstAdmin untuk mendaftarkan admin pertama tanpa autentikasi
func (d *HttpDeliveryUser) RegisterFirstAdmin(c *fiber.Ctx) error {
	var user domain.User
	if err := c.BodyParser(&user); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request body",
		})
	}

	// Hanya izinkan registrasi admin
	user.Role = "admin"

	// Validasi data user
	if user.Username == "" || user.Password == "" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"error": "Username and password are required",
		})
	}

	// Cek apakah sudah ada admin
	_, err := d.HTTP.GetAll(context.Background())
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"error": fmt.Sprintf("Failed to check existing users: %v", err),
		})
	}	

	registeredUser, err := d.HTTP.RegisterUser(context.Background(), &user)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"error": fmt.Sprintf("Failed to register user: %v", err),
		})
	}

	return c.Status(http.StatusCreated).JSON(fiber.Map{
		"message": "Admin registered successfully",
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
		return "", fmt.Errorf("invalid expiration hours: %v", err)
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
		return "", fmt.Errorf("failed to sign token: %v", err)
	}

	log.Printf("Token generated successfully for user %s", username) // Log saat token berhasil dibuat
	return tokenString, nil
}
