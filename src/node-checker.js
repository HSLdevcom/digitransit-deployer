const debug = require('debug')('node-checker');
const difference = require('lodash.difference');
const {postSlackMessage} = require('./util');
const rp = require('request-promise');

var lastResponseNodeIPs;

/*
 * Checks if the number of nodes in the network remains the same.
 * If node(s) are added to the network, the number of added nodes
 * will be posted to slack. If node(s) are missing from the network,
 * for each missing node, a message containing missing nodes IP
 * will be sent to slack. 
 */

const sendNotification = (message) => {
  debug(message);
  postSlackMessage(message);
}

module.exports = {
  name:'node-checker',
  command: (nodes) => {
    nodes.forEach((node) => {
      if (node.health !== 0) {
        let url = `http://leader.mesos:1050/system/health/v1/nodes/${node.host_ip}/units`;
        rp(url).then(res => {
          const data = JSON.parse(res);
          if ('units' in data && data.units) {
            data.units.forEach((unit) => {
              if (unit.health !== 0) {
                sendNotification(`${node.host_ip}: ${unit.name} is unhealthy.`);
              }
            })
          } else {
            sendNotification(`${node.host_ip} is unhealthy.`);
          }
        });
      }
    });

    const newResponseNodeIPs = nodes.map(x => x.host_ip);
    const removedIPs = difference(lastResponseNodeIPs, newResponseNodeIPs);
    const newIPs = difference(newResponseNodeIPs, lastResponseNodeIPs);

    if (lastResponseNodeIPs && newIPs.length !== 0) {
      const addedNodeCount = nodes.length - lastResponseNodeIPs.length;
      if (newIPs.length === addedNodeCount) {
        newIPs.forEach((nodeIP) => {
          sendNotification(`${nodeIP}: node was added to the network.`);
        });
      } else {
        sendNotification(`${removedIPs.join(', ')} were replaced by ${newIPs.join(', ')}.`);
        if (addedNodeCount !== 0) {
          sendNotification(`${addedNodeCount} nodes were added to the network.`);
        }
      }
    } else if (lastResponseNodeIPs && removedIPs.length !== 0) {
      const removedNodeCount = lastResponseNodeIPs.length -  nodes.length;
      if (removedIPs.length === removedNodeCount) {
        removedIPs.forEach((nodeIP) => {
          sendNotification(`${nodeIP}: node is missing from the network.`);
        });
      } else {
        sendNotification(`${removedIPs.join(', ')} were replaced by ${newIPs.join(', ')}.`);
        if (removedNodeCount !== 0) {
          sendNotification(`${removedNodeCount} nodes are missing from the network.`);
        }
      }
    }
    lastResponseNodeIPs = newResponseNodeIPs;
  }
};
