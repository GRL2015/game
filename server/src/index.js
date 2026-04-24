const { createApp } = require("./app");
const { CONFIG } = require("./config");

const app = createApp();

app.listen(CONFIG.port, () => {
  // eslint-disable-next-line no-console
  console.log(`Neon Drift backend listening on :${CONFIG.port}`);
});
