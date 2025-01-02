package delivery

import (
	"SIE-SRC/services/usecase"
	"encoding/json"
	"net/http"

	"github.com/gofiber/fiber/v2"
)

type AlgoritmaHandler struct {
	AlgoritmaUsecase usecase.AlgoritmaUsecase
}

func NewAlgoritmaHandler(app *fiber.App, au usecase.AlgoritmaUsecase) {
	handler := &AlgoritmaHandler{
		AlgoritmaUsecase: au,
	}

	app.Post("/algoritma/rekomendasi", handler.GetRekomendasiProduk)
}

type RekomendasiRequest struct {
	Transactions [][]string `json:"transactions"`
	Product      string     `json:"product"`
	MinSupport   float64    `json:"minSupport"`
}

func (h *AlgoritmaHandler) GetRekomendasiProduk(c *fiber.Ctx) error {
	var req RekomendasiRequest
	if err := json.Unmarshal(c.Body(), &req); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request body",
		})
	}

	recommendations, err := h.AlgoritmaUsecase.GetRekomendasiProduk(req.Transactions, req.Product, req.MinSupport)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to get recommendations",
		})
	}

	return c.JSON(recommendations)
}
