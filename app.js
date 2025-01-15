const util = require("util");
const axios = require("axios");
const { exit } = require("process");

module.exports = async function (plugin) {
  let auth;
  let apiUrl = plugin.params.data.apiuri;
  let apiUsername = plugin.params.data.username;
  let apiPassword = plugin.params.data.password;
  let interval = 15000;
  if (plugin.params.data.interval > 0) {
    interval = plugin.params.data.interval * 1000;
  }
  let toSend = [];
  let requestId;
  let groupChannels;

  sendNext();
  main(plugin.channels.data);

  async function main(channels) {
    groupChannels = groupByUniq(channels, "entitytype");

    await authenticate(apiUsername, apiPassword);

    monitor(channels);
  }

  function sendNext() {
    if (toSend.length > 0) {
      plugin.sendData(toSend);
      toSend = [];
    }
    setTimeout(sendNext, interval / 2);
  }

  async function monitor(channels) {
    channels.forEach((channel) => {
      channel.processed = false;
    });

    try {
      Object.keys(groupChannels).forEach(async (key) => {
        let items;
        switch (key) {
          case "Host":
            items = await getHosts(groupChannels[key].ref);
            break;
          case "Item":
            items = await getItems(groupChannels[key].ref);
            break;
          case "Trigger":
            items = await getTriggers(groupChannels[key].ref);
            break;
          default:
            plugin.log("Unknown item type: " + key);
        }

        channels.forEach((channel) => {
          let item = items.find((it) => channel.itemid === it[entitytype]);

          if (item) {
            toSend.push({
              id: channel.id,
              value: item[channel.valuename],
              chstatus: 0,
              ts: new Date().getTime(),
            });
            channel.processed = true;
          }
        });
      });

      channels.forEach((channel) => {
        if (!channel.processed) {
          toSend.push({
            id: channel.id,
            chstatus: 1,
            ts: new Date().getTime(),
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
      auth = response.data.result;
    } catch (error) {
      plugin.log("Error in authenticate: " + util.inspect(error));
      exit(403, "Error in authenticate");
    }
  }

  async function getHosts(hostItems) {
    try {
      const response = await axios.post(apiUrl, {
        jsonrpc: "2.0",
        method: "host.get",
        params: {
          output: "extend",
          hostids: hostItems.map((host) => host.entityid),
        },
        auth: auth,
        id: requestId,
      });

      requestId++;
      return response.data.result;
    } catch (error) {
      plugin.log("Error in getHostIds: " + util.inspect(error));
    }
  }

  async function getItems(itemItems) {
    try {
      const response = await axios.post(apiUrl, {
        jsonrpc: "2.0",
        method: "item.get",
        params: {
          output: "extend",
          itemids: itemItems.map((item) => item.entityid),
        },
        auth: auth,
        id: requestId,
      });

      requestId++;
      return response.data.result;
    } catch (error) {
      plugin.log("Error in getItems: " + util.inspect(error));
    }
  }

  async function getTriggers(triggerItems) {
    try {
      const response = await axios.post(apiUrl, {
        jsonrpc: "2.0",
        method: "trigger.get",
        params: {
          output: "extend",
          triggerids: triggerItems.map((trigger) => trigger.entityid),
        },
        auth: auth,
        id: requestId,
      });

      requestId++;
      return response.data.result;
    } catch (error) {
      plugin.log("Error in getTriggers: " + util.inspect(error));
    }
  }

  function groupByUniq(objectArray, property) {
    const uniq = {};
    return objectArray.reduce((acc, obj) => {
      let key = obj[property];
      if (!acc[key]) {
        acc[key] = {};
        acc[key].ref = [];
      }
      if (uniq[obj.chanId] == undefined) {
        uniq[obj.chanId] = obj;
        acc[key].ref.push(obj);
      }

      return acc;
    }, {});
  }
};
