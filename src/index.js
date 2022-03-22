const express = require('express');
const morgan = require('morgan');
const path = require('path');
const app = express();
const bodyParser = require('body-parser');
const http = require('http').Server(app);
const io = require('socket.io')(http);


app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
const {readFileSync} = require('fs');

// Opciones del Servidor Node & Express & Ejs
const port = process.env.PORT || 5001;
app.use(express.static(path.join(__dirname, 'public')));
app.use(require('./routes'));
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(morgan('dev'));

// lanzando el servidor
app.listen(port, () => {
  console.log(`Server on port : ${port}`);
  console.log(`http://localhost:${port}`);
  console.log(parseInt(Date.now() / 1000) + 20 * 60)
});

io.on('connection', function(socket){
  // Crear el JWT para la autenticacion del dispositivo
  const createJwt = (projectId, privateKeyFile, algorithm) => {
    const token = {
      iat: parseInt(Date.now() / 1000),
      exp: parseInt(Date.now() / 1000) + 20 * 60, 
      aud: projectId,
    };
    const privateKey = fs.readFileSync(privateKeyFile);
    return jwt.sign(token, privateKey, {algorithm: algorithm});
  };

  const publishAsync = (mqttTopic, client) => {
    socket.on('values', function(data){
      console.log('Publicando: ' + JSON.stringify(data));
      client.publish(mqttTopic, JSON.stringify(data), {qos: 1});
    });
  };
  console.log("WEBSOCKET CONECTADO")

  const projectId = `new-iot-1772b`;
  const deviceId = `dispositivo-1`;
  const registryId = `my-registry`;
  const region = `us-central1`;
  const algorithm = `RS256`;
  const privateKeyFile = `./rsa_private.pem`;
  const mqttBridgeHostname = `mqtt.googleapis.com`;
  const mqttBridgePort = 8883;
  const messageType = `events`;

  const mqttClientId = `projects/${projectId}/locations/${region}/registries/${registryId}/devices/${deviceId}`;

  const connectionArgs = {
    host: mqttBridgeHostname,
    port: mqttBridgePort,
    clientId: mqttClientId,
    username: 'unused',
    password: createJwt(projectId, privateKeyFile, algorithm),
    protocol: 'mqtts',
    secureProtocol: 'TLSv1_2_method',
  };

  const client = mqtt.connect(connectionArgs);

  client.subscribe(`/devices/${deviceId}/config`, {qos: 1});

  client.subscribe(`/devices/${deviceId}/commands/#`, {qos: 0});

  const mqttTopic = `/devices/${deviceId}/${messageType}`;

  client.on('connect', success => {
    console.log('connect');
    if (!success) {
      console.log('Cliente no conectado...');
    } else {
      publishAsync(mqttTopic, client);
    }
  });

  client.on('close', () => {
    console.log('close');
  });

  client.on('message', (topic, message) => {
    let messageStr = 'Message received: ';
    if (topic === `/devices/${deviceId}/config`) {
      messageStr = 'Config message received: ';
    } else if (topic.startsWith(`/devices/${deviceId}/commands`)) {
      messageStr = 'Command message received: ';
    }
    messageStr += Buffer.from(message, 'base64').toString('ascii');
    console.log(messageStr);
  });
})