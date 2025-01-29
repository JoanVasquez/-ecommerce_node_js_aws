import { HttpResponse } from "../../utils/HttpResponse"; // Adjust the path as needed

describe("HttpResponse", () => {
  it("should initialize properties correctly using the constructor", () => {
    const response = new HttpResponse(200, "OK", { key: "value" }, "No error");

    expect(response.statusCode).toBe(200);
    expect(response.message).toBe("OK");
    expect(response.data).toEqual({ key: "value" });
    expect(response.error).toBe("No error");
  });

  it("should create a successful response using the success method", () => {
    const data = { id: 1, name: "Test" };
    const message = "Request successful";
    const statusCode = 201;

    const response = HttpResponse.success(data, message, statusCode);

    expect(response.statusCode).toBe(201);
    expect(response.message).toBe("Request successful");
    expect(response.data).toEqual(data);
    expect(response.error).toBeUndefined();
  });

  it("should use default values for message and statusCode in success method", () => {
    const data = { id: 1, name: "Default Test" };

    const response = HttpResponse.success(data);

    expect(response.statusCode).toBe(200);
    expect(response.message).toBe("Success");
    expect(response.data).toEqual(data);
    expect(response.error).toBeUndefined();
  });

  it("should create an error response using the error method", () => {
    const message = "Something went wrong";
    const statusCode = 400;
    const errorDetail = "Invalid input";

    const response = HttpResponse.error(message, statusCode, errorDetail);

    expect(response.statusCode).toBe(400);
    expect(response.message).toBe("Something went wrong");
    expect(response.data).toBeUndefined();
    expect(response.error).toBe("Invalid input");
  });

  it("should use default values for message and statusCode in error method", () => {
    const response = HttpResponse.error();

    expect(response.statusCode).toBe(500);
    expect(response.message).toBe("An error occurred");
    expect(response.data).toBeUndefined();
    expect(response.error).toBeUndefined();
  });
});
