const util = require("util");
const axios = require("axios");
const { exit } = require("process");

module.exports = async function (plugin) {
  let auth;
  let apiUrl;
  let apiUsername;
  let apiPassword;
  let toSend = [];
  let requestId;
  let hostsArray = [];
  let itemKeys = [];
  let interval = 15000;

  sendNext();
  main(plugin);

  async function main(plugin) {
    apiUrl = plugin.params.data.apiuri;
    apiUsername = plugin.params.data.username;
    apiPassword = plugin.params.data.password;
    if (plugin.params.data.interval > 0) {
      interval = plugin.params.data.interval * 1000;
    }

    auth = await authenticate(apiUsername, apiPassword);

    await setHosts(plugin.channels.data);

    let keys = plugin.channels.data.map((channel) => channel.itemkey);
    itemKeys = [...new Set(keys)];

    monitor(plugin.channels.data);
  }

  function sendNext() {
    if (toSend.length > 0) {
      plugin.sendData(toSend);
      toSend = [];
    }
    setTimeout(sendNext, interval / 2);
  }

  async function monitor(channels) {
    try {
      const response = await axios.post(apiUrl, {
        jsonrpc: "2.0",
        method: "item.get",
        params: {
          output: "extend",
          hostids: hostsArray.map((host) => host.hostid),
          search: { key_: itemKeys },
        },
        auth: auth,
        id: requestId,
      });

      requestId++;
      let items = response.data.result;

      channels.forEach((channel) => {
        let item = items.find((it) => {
          return (
            channel.itemkey === it.key_ &&
            hostsArray.find((obj) => obj.host === channel.hostname).hostid ===
              it.hostid
          );
        });

        if (item) {
          toSend.push({
            id: channel.id,
            value: item.lastvalue,
            chstatus: 0,
            ts: new Date().getTime(),
          });
        } else {
          toSend.push({
            id: channel.id,
            chstatus: 1,
          });
        }
      });
    } catch (error) {
      plugin.log("Error in monitor: " + util.inspect(error));
    }

    setTimeout(() => {
      monitor(channels);
    }, interval);
  }

  async function authenticate(username, password) {
    try {
      requestId = 1;
      const response = await axios.post(apiUrl, {
        jsonrpc: "2.0",
        method: "user.login",
        params: { user: username, password: password },
        id: requestId,
        auth: null,
      });

      requestId++;
      return response.data.result;
    } catch (error) {
      plugin.log("Error in authenticate: " + util.inspect(error));
      exit(1, "Error in authenticate");
    }
  }

  async function setHosts(channels) {
    try {
      let hosts = channels.map((channel) => channel.hostname);
      let uniqueHosts = [...new Set(hosts)];

      const response = await axios.post(apiUrl, {
        jsonrpc: "2.0",
        method: "host.get",
        params: {
          output: ["hostid", "host"],
          filter: { host: uniqueHosts },
        },
        auth: auth,
        id: requestId,
      });

      requestId++;
      hostsArray = response.data.result;
    } catch (error) {
      plugin.log("Error in getHostIds: " + util.inspect(error));
      exit(2, "Error in getHostIds");
    }
  }
};
