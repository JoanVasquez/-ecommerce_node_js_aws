import { uploadFile } from "../utils/s3Config";
import { APIGatewayProxyHandler } from "aws-lambda";
import logger from "../utils/logger"; // Import Winston logger
import { HttpResponse } from "../utils/HttpResponse"; // Import HttpResponse model

export const uploadFileController: APIGatewayProxyHandler = async (event) => {
  logger.info("[uploadFileController] Received request for file upload");

  const body = JSON.parse(event.body || "{}");
  const { file, filename, mimeType } = body;

  if (!file || !filename || !mimeType) {
    logger.warn("[uploadFileController] Missing file or metadata in request", {
      body,
    });

    return {
      statusCode: 400,
      body: JSON.stringify(HttpResponse.error("Missing file or metadata", 400)),
    };
  }

  const buffer = Buffer.from(file, "base64");
  logger.info("[uploadFileController] File metadata parsed", {
    filename,
    mimeType,
  });

  try {
    const fileUrl = await uploadFile(filename, buffer, mimeType);

    logger.info("[uploadFileController] File uploaded successfully", {
      filename,
      fileUrl,
    });

    return {
      statusCode: 200,
      body: JSON.stringify(
        HttpResponse.success({ fileUrl }, "File uploaded successfully")
      ),
    };
  } catch (error) {
    logger.error("[uploadFileController] File upload failed", {
      filename,
      error: (error as Error).message,
    });

    return {
      statusCode: 500,
      body: JSON.stringify(
        HttpResponse.error("File upload failed", 500, (error as Error).message)
      ),
    };
  }
};
