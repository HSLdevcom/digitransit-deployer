import * as k8s from '@kubernetes/client-node';

const kubeconfig = new k8s.KubeConfig();
kubeconfig.loadFromCluster();

const getDeployments = () => {
  return new Promise((resolve, reject) => {
    const appsApi = kubeconfig.makeApiClient(k8s.AppsV1Api);
    appsApi
      .listNamespacedDeployment({ namespace: 'default' })
      .then(deploymentResponse => {
        const promises = [];
        const deployments = deploymentResponse.items;
        for (const deployment of deployments) {
          promises.push(
            new Promise(resolve => {
              const deploymentName = deployment.metadata.name;
              const labelSelector = `app=${deploymentName}`;
              console.log(
                `Fetching replica sets for deployment: ${deploymentName}`,
              );
              appsApi
                .listNamespacedReplicaSet({
                  namespace: 'default',
                  labelSelector,
                })
                .then(replicaSetResponse => {
                  const replicaSets = replicaSetResponse.items;
                  let newestReplicaSetTime;
                  for (const replicaSet of replicaSets) {
                    const creationTime = replicaSet.metadata.creationTimestamp;
                    if (
                      !newestReplicaSetTime ||
                      creationTime > newestReplicaSetTime
                    ) {
                      newestReplicaSetTime = creationTime;
                    }
                  }
                  resolve({
                    ...deployment,
                    version: newestReplicaSetTime
                      ? newestReplicaSetTime.getTime()
                      : null,
                  });
                })
                .catch(err => {
                  reject(err);
                });
            }),
          );
        }
        Promise.all(promises).then(values => {
          // some helm installed deployment didn't have the creation time for a replica set for some reason
          resolve(values.filter(value => value.version != null));
        });
      })
      .catch(err => {
        reject(err);
      });
  });
};

// Restart by modifying deployment annotation (the same annotation is edited when kubectl rollout
// restart deployment is run).
// It is important the deployment name and label "app" have same values
const restartDeployment = name => {
  return new Promise((resolve, reject) => {
    const appsApi = kubeconfig.makeApiClient(k8s.AppsV1Api);
    const now = new Date();
    const patch = [
      {
        op: 'replace',
        path: '/spec/template/metadata/annotations',
        value: {
          'kubectl.kubernetes.io/restartedAt': now.toISOString(),
        },
      },
    ];

    appsApi
      .patchNamespacedDeployment({ name, namespace: 'default', body: patch })
      .then(() => {
        resolve(name);
      })
      .catch(err => {
        reject(err);
      });
  });
};

export default {
  getDeployments,
  restartDeployment,
};
