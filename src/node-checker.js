const debug = require('debug')('node-checker');
const difference = require('lodash.difference');
const {postSlackMessage} = require('./util');

var lastResponseNodeIPs;

/*
 * Checks if the number of nodes in the network remains the same.
 * If node(s) are added to the network, the number of added nodes
 * will be posted to debug. If node(s) are missing from the network,
 * for each missing node, a message will be sent to slack. 
 */
module.exports = {
  name:'node-checker',
  command: (nodes) => {
    newResponseNodeIPs = nodes.map(x => x.host_ip);
    nodes.forEach((node) => {
      if (node.health !== 0) {
        debug(node.host_ip + ": node is unhealthy.");
        postSlackMessage(node.host_ip + ": node is unhealthy.");
      }
    });
    if (lastResponseNodeIPs && nodes.length > lastResponseNodeIPs.length) {
      debug(nodes.length - lastResponseNodeIPs.length + " nodes were added to the network.");
    } else if (lastResponseNodeIPs && nodes.length < lastResponseNodeIPs.length) {
      const missingNodes = difference(lastResponseNodeIPs, newResponseNodeIPs);
      missingNodes.forEach((nodeIP) => {
        debug(nodeIP + ": node is missing from the network.");
        postSlackMessage(nodeIP + ": node is missing from the network.");
      });
    }
    lastResponseNodeIPs = newResponseNodeIPs;
  }
};
