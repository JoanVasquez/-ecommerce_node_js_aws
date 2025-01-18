import { UserService } from "../services/UserService";
import { UserRepository } from "../repositories/UserRepository";

describe("UserService", () => {
  it("registers a user", async () => {
    const mockRepo = {
      createUser: jest.fn().mockResolvedValue({ id: 1, username: "test" }),
    } as any;
    const service = new UserService(mockRepo);

    const user = await service.register("test", "password");
    expect(user).toEqual({ id: 1, username: "test" });
  });
});
