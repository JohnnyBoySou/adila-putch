import { TestsService as Wails } from "@bindings/services";
import type { TestInput } from "@bindings/services";

export type { Test, TestInput, TestStep, TestAssertion, TestRunResult } from "@bindings/services";

export const TestService = {
  findAll() {
    return Wails.FindAll();
  },

  findById(id: string) {
    return Wails.FindByID(id);
  },

  create(input: TestInput) {
    return Wails.Create(input);
  },

  update(id: string, input: TestInput) {
    return Wails.Update(id, input);
  },

  delete(id: string) {
    return Wails.Delete(id);
  },

  run(id: string) {
    return Wails.Run(id);
  },
};
