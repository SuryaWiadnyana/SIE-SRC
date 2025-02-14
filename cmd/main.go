package main

import (
	"context"
	"flag"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"SIE-SRC/config"
	"SIE-SRC/domain"
	"SIE-SRC/services/delivery"
	"SIE-SRC/services/repository"
	"SIE-SRC/services/usecase"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/limiter"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/joho/godotenv"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

var (
	mongoClient *mongo.Client
)

func init() {
	// Load environment variables from .env
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found")
	}
}

func main() {
	httpServer := flag.Bool("start-http", true, "Start HTTP server for SIE-SRC")
	flag.Parse()

	if *httpServer {
		startHTTPServer()
	}
}

func startHTTPServer() {
	app := fiber.New(config.GetFiberConfig())

	// MongoDB connection
	mongoURI := config.GetMongoConnString()
	clientOptions := options.Client().ApplyURI(mongoURI)
	var err error
	mongoClient, err = mongo.Connect(context.Background(), clientOptions)
	if err != nil {
		log.Fatal("MongoDB connection error:", err)
	}
	defer mongoClient.Disconnect(context.Background())

	// Mendapatkan objek *mongo.Database dari mongoClient
	db := mongoClient.Database("SIE_SRC")

	// Middleware setup
	app.Use(logger.New())
	app.Use(cors.New(cors.Config{
		AllowOrigins:     "http://127.0.0.1:5501",
		AllowMethods:     "GET,POST,PUT,DELETE,OPTIONS",
		AllowHeaders:     "Origin, Content-Type, Accept, Authorization",
		AllowCredentials: true,
		MaxAge:           300,
	}))
	app.Use(limiter.New(limiter.Config{
		Max:        100,
		Expiration: 30 * time.Second,
	}))

	// Routes
	app.Get("/", func(c *fiber.Ctx) error {
		return c.Status(fiber.StatusOK).SendString("SIE-SRC API is up and running")
	})

	// User Repository dan Use Case Route
	userRepo := repository.NewMongoRepoUser(db)
	userUseCase := usecase.NewMongoUseCaseUser(userRepo, 10*time.Second)
	delivery.NewHttpDeliveryUser(app, userUseCase)

	// Algoritma Repository Route
	algoritmaData := domain.Algoritma{
		Items:   []string{},
		Support: 0,
	}
	algoritmaRepo := repository.NewMongoAlgoritmaRepo(algoritmaData, 10*time.Second) // Tambahkan argumen sesuai definisi

	// Produk Repository
	produkRepo := repository.NewMongoRepoProduk(db)

	// Penjualan Repository dan Use Case route
	penjualanRepo := repository.NewMongoRepoPenjualan(db, produkRepo)
	penjualanUseCase := usecase.NewUseCasePenjualan(penjualanRepo, 10*time.Second)

	// Detail Penjualan Repository dan Use Case route
	detailPenjualanRepo := repository.NewMongoRepoDetailPenjualan(db)
	detailPenjualanUC := usecase.NewDetailPenjualanUsecase(detailPenjualanRepo)
	log.Printf("Initializing detail penjualan use case...")

	// Inisialisasi handler penjualan dengan detail penjualan use case
	produkUseCase := usecase.NewUseCaseProduk(produkRepo, algoritmaRepo, penjualanRepo, 10*time.Second)
	delivery.NewHttpDeliveryPenjualan(app, penjualanUseCase, userUseCase, detailPenjualanUC, produkUseCase)
	log.Printf("Handler penjualan initialized with detail penjualan use case")

	// Inisialisasi handler detail penjualan
	delivery.NewHttpDeliveryDetailPenjualan(app, detailPenjualanUC)
	log.Printf("Detail penjualan handler initialized")

	// Produk Use Case route
	delivery.NewHttpDeliveryProduk(app, produkUseCase)

	// Algoritma Use Case and Handler
	algoritmaUseCase := usecase.NewAlgoritmaUsecase(algoritmaRepo)
	delivery.NewAlgoritmaHandler(app, algoritmaUseCase)

	// Signal handling for graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	go func() {
		<-quit
		log.Println("Shutting down server...")
		if err := app.Shutdown(); err != nil {
			log.Fatalf("Server shutdown error: %v", err)
		}
	}()

	// Start Fiber server
	listenAddress := config.GetFiberListenAddress()
	log.Println("Starting HTTP server on", listenAddress)
	if err := app.Listen(listenAddress); err != nil {
		log.Fatal("Server startup error:", err)
	}
}
