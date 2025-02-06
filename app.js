const util = require("util");
const axios = require("axios");
const GroupedData = require("./lib/grouped-data");
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
  const groupedChannels = new GroupedData("entitytype");

  sendNext();
  main();

  plugin.onChange("channels", async (data) => {
    const channels = await plugin.channels.get();
    let changedChannels = groupByUniq(data, "op");
    Object.keys(changedChannels).forEach((key) => {
      switch (key) {
        case "add":
        case "update":
          changedChannels[key].ref.forEach((channel) => {
            let index = channels.findIndex((ch) => ch._id === channel._id);
            if (index !== -1) {
              groupedChannels.addOrUpdate(channel);
            }
          });
          break;
        case "delete":
          changedChannels[key].ref.forEach((channel) => {
            groupedChannels.delete(channel._id);
          });
          break;
        default:
          plugin.log("Unknown operation: " + key);
      }
    });
  });

  async function main() {
    let channels = await plugin.channels.get();

    channels.forEach((channel) => {
      groupedChannels.addOrUpdate(channel);
    });

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
    try {
      await Promise.all(
        (await groupedChannels.getCategories()).map(async (category) => {
          const channels = await groupedChannels.getByCategory(category);
          let items;
          switch (category) {
            case "hostid":
              items = await getHosts(channels);
              break;
            case "itemid":
              items = await getItems(channels);
              break;
            case "triggerid":
              items = await getTriggers(channels);
              break;
            default:
              plugin.log("Unknown item type: " + category);
          }

          channels.forEach((channel) => {
            item = items?.find((it) => channel.entityid == it[category]);
            if (item) {
              toSend.push({
                id: channel.id,
                value: item[channel.valuename],
                chstatus: 0,
                ts: new Date().getTime(),
              });
            } else {
              toSend.push({
                id: channel.id,
                chstatus: 1,
                ts: new Date().getTime(),
              });
            }
          });
        })
      );
    } catch (error) {
      plugin.log("Error in monitor: " + util.inspect(error));
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
