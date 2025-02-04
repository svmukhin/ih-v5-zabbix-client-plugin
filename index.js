const util = require("util");
const app = require("./app");

(async () => {
  let plugin;
  try {
    const opt = getOptFromArgs();
    const pluginapi = opt && opt.pluginapi ? opt.pluginapi : "ih-plugin-api";
    plugin = require(pluginapi + "/index.js")();

    plugin.log("Plugin zabbix client has started.", 0);

    plugin.params.data = await plugin.params.get();

    app(plugin);
  } catch (err) {
    plugin.exit(8, `Error: ${util.inspect(err)}`);
  }
})();

function getOptFromArgs() {
  let opt;
  try {
    opt = JSON.parse(process.argv[2]);
  } catch (e) {
    opt = {};
  }
  return opt;
}
