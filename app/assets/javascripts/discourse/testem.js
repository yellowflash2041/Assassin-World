module.exports = {
  test_page: "tests/index.html?hidepassed",
  disable_watching: true,
  launch_in_ci: ["Chrome"],
  launch_in_dev: ["Chrome"],
  browser_args: {
    Chrome: [
      // --no-sandbox is needed when running Chrome inside a container
      process.env.CI || process.env.EMBER_CLI ? "--no-sandbox" : null,
      "--headless",
      "--disable-dev-shm-usage",
      "--disable-software-rasterizer",
      "--mute-audio",
      "--remote-debugging-port=4201",
      "--window-size=1440,900",
    ].filter(Boolean),
  },
};
