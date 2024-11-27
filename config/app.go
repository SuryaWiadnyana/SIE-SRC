package config

import "os"

func GetAppEnvironment() string {
	env := os.Getenv("APP_ENV")
	if env != "" {
		return env
	}
	return ""
}

func GetAppName() string {
	env := os.Getenv("APP_NAME")
	if env != "" {
		return env
	}
	return ""
}

func GetAppPort() string {
	env := os.Getenv("APP_PORT")
	if env != "" {
		return env
	}
	return "8000"
}
