import express from 'express';
import dotenv from 'dotenv';
import got from 'got';
import {
  getOauthToken,
  deleteOauthToken,
  generateRandomSHA256Hash,
  generateHash,
  verifySignature,
  checkCertificateExpiration
} from './utils.js';

dotenv.config();
const app = express();
const port = process.env.PORT;
const swiftApiHost = process.env.SWIFT_API_HOST;

let currentReqData = {
  hash: null,
  data: null,
  session: null
};


app.use(express.json());

// Test API for backend healthcheck
app.get('/api/test', (req, res) => {
  res.json({ message: 'Hello from the Backend!' });
});

// Call Digital Token authentication API
app.post('/api/auth', async (req, res) => {
  console.log("Called auth");
  const bearerToken = await getOauthToken();
  if(bearerToken == null) {
    res.json({"result": "Backend error getting Oauth token"});
    return;
  }
  const corpId = req.body['userId'];

  const { hash, randomString } = await generateRandomSHA256Hash();
  currentReqData.hash = hash;
  currentReqData.data = randomString;

  let requestBody = {
      "requesterBic": "TESTBIC8",
      "requesterService": "Bank App Demo",
      "userId": corpId,
      "challenge": hash,
      "requiredSecurityLevel": "EASY"
  };

  const options = {
    headers: {
        Accept: "application/json",
        'Content-Type': "application/json",
        Authorization: "Bearer " + bearerToken
    },
    json: requestBody,
    method: 'POST',
    followRedirect: true
  };
  console.log(options);

  const data = await got(
    "https://" + swiftApiHost + "/swift-token-management/v1/digital-token/authentication", 
    options
  ).json();
  console.log(data);
  if(data.sessionId) currentReqData.session = data.sessionId;

  await deleteOauthToken(bearerToken);

  res.json(data);
});

// Call Digital Token signing API
app.post('/api/sign', async (req, res) => {
  console.log("Called sign");
  const bearerToken = await getOauthToken();
  if(bearerToken == null) {
    res.json({"Error": "Backend error getting Oauth token"});
    return;
  }
  if(req.body.digest) currentReqData.hash = req.body.digest;
  if(req.body.digest && req.body.message && (await generateHash(req.body.message)) === req.body.digest) {
    // We know the data behind the hash, so we can use this in verification
    currentReqData.data = req.body.message;
  } else {
    // We do not know the data behind the hash, so we cannot verify
    currentReqData.data = null;
  }

  let requestBody = {
    "requesterBic": req.body.requesterBic,
    "requesterService": req.body.requesterService,
    "userId": req.body.userId,
    "digest": req.body.digest,
    "digestAlg": req.body.digestAlg,
    "userPreferredMethod": req.body.userPreferredMethod,
    "requiredSecurityLevel": req.body.requiredSecurityLevel,
    "message": req.body.message
  };

  const options = {
    headers: {
        Accept: "application/json",
        'Content-Type': "application/json",
        Authorization: "Bearer " + bearerToken
    },
    json: requestBody,
    method: 'POST',
    followRedirect: true
  };
  console.log(options);

  const data = await got(
    "https://" + swiftApiHost + "/swift-token-management/v1/digital-token/signature", 
    options
  ).json();
  console.log(data);
  if(data.sessionId) currentReqData.session = data.sessionId;

  await deleteOauthToken(bearerToken);

  res.json(data);
});

// Call Digital Token status API
app.get('/api/status/:sessionId', async (req, res) => {
  console.log("Called status");
  const bearerToken = await getOauthToken();
  if(bearerToken == null) {
    res.json({"Error": "Backend error getting Oauth token"});
    return;
  }

  const sessionId = req.params.sessionId;
  const options = {
    headers: {
        Accept: "application/json",
        'Content-Type': "application/json",
        Authorization: "Bearer " + bearerToken
    },
    method: 'GET',
    followRedirect: true
  };

  const data = await got(
    "https://" + swiftApiHost + "/swift-token-management/v1/digital-token/" + sessionId, 
    options
  ).json();
  console.log(data);

  if(sessionId == currentReqData.session && data.signature && data.certificate){
    // Check expiration
    console.log("Checking certificate expiration");
    checkCertificateExpiration(data.certificate);

    // TODO: Check data.certificate against Swift CRL

    // Verify signature
    console.log("Validating signature");
    if(currentReqData.data) {
      console.log(currentReqData);
      verifySignature(data.signature, data.certificate, currentReqData.data);
    } else {
      console.log("Don't have initial data to verify.");
    }

    // Reset currentReqData
    currentReqData.hash = null;
    currentReqData.session = null;
    currentReqData.data = null;
  }

  await deleteOauthToken(bearerToken);
  
  res.json(data);
});


app.use(express.static('../frontend'));

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});