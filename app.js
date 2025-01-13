const util = require("util");
const axios = require("axios");

module.exports = async function (plugin) {
  let toSend = [];
  let groupChannels;

  sendNext();
  main(plugin.channels.data);

  function main(channels) {
    monitor();
  }

  function sendNext() {
    if (toSend.length > 0) {
      plugin.sendData(toSend);
      toSend = [];
    }
    setTimeout(sendNext, 2500);
  }

  function monitor() {
    setTimeout(() => {
      monitor();
    }, 5000);
  }
};
