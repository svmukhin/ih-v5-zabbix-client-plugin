const util = require("util");
const axios = require("axios");
const ReadWriteLock = require("./lib/readwritelock");
const { exit } = require("process");

module.exports = async function (plugin) {
  const lock = new ReadWriteLock();

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

  let channels = await plugin.channels.get();

  sendNext();
  main();

  plugin.onChange("channels", async (data) => {
    let changedChannels = groupByUniq(data, "op");
    await lock.writeLock();
    try {
      Object.keys(changedChannels).forEach(async (key) => {
        switch (key) {
          case "add":
            changedChannels[key].ref.forEach((channel) => {
              channels.push(channel);
            });
            break;
          case "update":
            changedChannels[key].ref.forEach((channel) => {
              let index = channels.findIndex((ch) => ch.id === channel.id);
              if (index > -1) {
                channels.splice(index, 1, channel);
              }
            });
            break;
          case "delete":
            changedChannels[key].ref.forEach((channel) => {
              let index = channels.findIndex((ch) => ch.id === channel.id);
              if (index > -1) {
                channels.splice(index, 1);
              }
            });
            break;
          default:
            plugin.log("Unknown operation: " + key);
        }
      });
      groupChannels = groupByUniq(channels, "entitytype");
    } finally {
      lock.writeUnlock();
    }
  });

  async function main() {
    groupChannels = groupByUniq(channels, "entitytype");

    await authenticate(apiUsername, apiPassword);

    monitor();
  }

  function sendNext() {
    if (toSend.length > 0) {
      plugin.sendData(toSend);
      toSend = [];
    }
    setTimeout(sendNext, interval / 2);
  }

  async function monitor() {
    await lock.readLock();
    try {
      channels.forEach((channel) => {
        if (!channel.processed) {
          toSend.push({
            id: channel.id,
            chstatus: 1,
            ts: new Date().getTime(),
          });
        }
        channel.processed = false;
      });

      Object.keys(groupChannels).forEach(async (key) => {
        let items;
        switch (key) {
          case "hostid":
            items = await getHosts(groupChannels[key].ref);
            break;
          case "itemid":
            items = await getItems(groupChannels[key].ref);
            break;
          case "triggerid":
            items = await getTriggers(groupChannels[key].ref);
            break;
          default:
            plugin.log("Unknown item type: " + key);
        }

        channels.forEach((channel) => {
          let item = items.find((it) => channel.entityid === it[key]);

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
    } catch (error) {
      plugin.log("Error in monitor: " + util.inspect(error));
    } finally {
      lock.readUnlock();
    }

    setTimeout(() => {
      monitor();
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
      if (uniq[obj.entityid] == undefined) {
        uniq[obj.entityid] = obj;
        acc[key].ref.push(obj);
      }

      return acc;
    }, {});
  }
};
