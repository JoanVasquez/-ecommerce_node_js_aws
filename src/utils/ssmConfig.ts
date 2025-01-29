import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";
import logger from "../utils/logger"; // Import your logger

// In-memory cache for storing SSM parameters
const cachedParameters: Record<string, string> = {};

/**
 * Fetch parameter value from SSM with caching.
 * @param name - Name of the parameter in SSM.
 * @param withDecryption - Whether the parameter is encrypted.
 * @returns The value of the parameter.
 */
export const getCachedParameter = async (
  name: string,
  withDecryption = true
): Promise<string> => {
  const ssmClient = new SSMClient({
    region: process.env.AWS_REGION || "us-east-1",
  });
  
  try {
    // Check if the parameter exists in the cache
    if (cachedParameters[name]) {
      logger.info(
        `[getCachedParameter] Parameter "${name}" retrieved from cache.`
      );
      return cachedParameters[name];
    }

    logger.info(`[getCachedParameter] Fetching parameter "${name}" from SSM.`);

    // Fetch the parameter from SSM
    const command = new GetParameterCommand({
      Name: name,
      WithDecryption: withDecryption,
    });
    const response = await ssmClient.send(command);

    if (!response.Parameter || !response.Parameter.Value) {
      logger.error(
        `[getCachedParameter] Parameter "${name}" not found or has no value.`
      );
      throw new Error(`Parameter ${name} not found or has no value.`);
    }

    // Cache the parameter value
    cachedParameters[name] = response.Parameter.Value;
    logger.info(
      `[getCachedParameter] Parameter "${name}" cached successfully.`
    );

    return response.Parameter.Value;
  } catch (error) {
    logger.error(
      `[getCachedParameter] Error fetching parameter "${name}": ${
        (error as Error).message
      }`,
      {
        error,
      }
    );
    throw new Error(`Could not fetch parameter: ${name}`);
  }
};
