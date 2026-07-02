"use strict";

const { LocalSink } = require("./local-sink");
const logger = require("../utils/logger");

/**
 * Factory chọn sink theo config.output.sink.
 * Phase 0-4: "local". Phase 5 sẽ thêm case "telegram".
 */
function createSink(config) {
  const kind = config.output?.sink || "local";
  switch (kind) {
    case "local":
      return new LocalSink(config.paths.output);
    // case "telegram":  // Phase 5
    //   return new TelegramSink(config.secrets, config.output);
    default:
      logger.warn(`Sink "${kind}" chưa hỗ trợ, fallback → local`);
      return new LocalSink(config.paths.output);
  }
}

module.exports = { createSink };
