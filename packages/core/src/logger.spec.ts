import { createLog, createLogger } from "./logger.js";
import { describe, it, vi, expect } from "vitest";

describe("测试logger", () => {
  const consoleLog = vi.spyOn(console, "log").mockImplementation(() => {});

  it("createLog 触发", () => {
    createLog("demo-pkg")("消息");
    createLog("")("消息");

    expect(consoleLog).toBeCalledTimes(2);
    consoleLog.mockClear();
  });

  it("createLogger 触发", () => {
    const logger = createLogger("test");
    logger.info("消息");
    logger.event("消息");
    logger.warn("消息");
    logger.error("消息");

    expect(consoleLog).toBeCalledTimes(4);
    consoleLog.mockClear();
  });

  it("createLogger 触发,logLevel=info", () => {
    const logger = createLogger("test", "info");
    logger.info("消息");
    logger.event("消息");
    logger.warn("消息");
    logger.error("消息");

    expect(consoleLog).toBeCalledTimes(4);
    consoleLog.mockClear();
  });

  it("createLogger 触发,logLevel=event", () => {
    const logger = createLogger("test", "event");
    logger.info("消息");
    logger.event("消息");
    logger.warn("消息");
    logger.error("消息");

    expect(consoleLog).toBeCalledTimes(3);
    consoleLog.mockClear();
  });

  it("createLogger 触发,logLevel=warn", () => {
    const logger = createLogger("test", "warn");
    logger.info("消息");
    logger.event("消息");
    logger.warn("消息");
    logger.error("消息");

    expect(consoleLog).toBeCalledTimes(2);
    consoleLog.mockClear();
  });

  it("createLogger 触发,logLevel=error", () => {
    const logger = createLogger("test", "error");
    logger.info("消息");
    logger.event("消息");
    logger.warn("消息");
    logger.error("消息");

    expect(consoleLog).toBeCalledTimes(1);
    consoleLog.mockClear();
  });

  it("createLogger 触发, logLevel=none", () => {
    const logger = createLogger("test", "none");
    logger.info("消息");
    logger.event("消息");
    logger.warn("消息");
    logger.error("消息");

    expect(consoleLog).toBeCalledTimes(0);
    consoleLog.mockClear();
  });

  it("createLogger 触发, logLevel=unknown", () => {
    const logger = createLogger("test", "unknown" as any);
    logger.info("消息");
    logger.event("消息");
    logger.warn("消息");
    logger.error("消息");

    expect(consoleLog).toBeCalledTimes(4);
    consoleLog.mockClear();
  });
});
