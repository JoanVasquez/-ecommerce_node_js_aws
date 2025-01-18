import { createLogger, format, transports } from "winston";

const logger = createLogger({
  level: "info", // Default log level
  format: format.combine(
    format.timestamp(), // Add timestamps
    format.json() // Log in JSON format
  ),
  transports: [
    new transports.Console(), // Log to console
    new transports.File({ filename: "logs/error.log", level: "error" }), // Log errors to a file
    new transports.File({ filename: "logs/combined.log" }), // Log all levels to a file
  ],
});

export default logger;
