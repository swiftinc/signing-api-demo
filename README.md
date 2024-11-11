# Signing API Demo Application

This is a simple **Express.js** application built to provide an example of a client application that utilizes **Swift's Signing APIs**. It consists of a backend, which invokes the Swift Oauth and Signing APIs, and a frontend, which provides a UI and shows how these APIs could reasonably be used.

## Table of Contents
1. [Installation](#installation)
2. [Usage](#usage)
3. [Environment Variables](#environment-variables)

## Installation

### Prerequisites  
Before running this project, make sure you have the following installed on your machine:

- **Node.js** (version 14.x or higher)
- **npm** (Node Package Manager)

Also, make sure you have followed the guide to "Create an app for Pilot" and for "Request web client certificate" on https://developer.swift.com

### Steps to Install

1. **Clone the repository:**  
```bash
git clone https://github.com/swiftinc/signing-api-demo.git
cd signing-api-demo
```

2. **Install dependencies:**   
Once you're in the project directory, run the following commands to install all the required dependencies:
```bash
cd backend
npm install
```

3. **Set environment variables**  
Set the required environment varibles. See: [Environment Variables](#environment-variables)

4. **Verify installation:**  
Make sure everything is working by running the application locally:
```bash
npm start
```

## Usage
### Running the Application
To start the Express server in development mode, run the following command:
```bash
cd backend
npm start
```

This will start the server on http://localhost:3000 by default. You should see a message like:
```text
Server listening on port 3000
```
You can visit this URL in your browser or use a tool like Postman or cURL to interact with the API endpoints.

## Environment Variables
This application requires the following environment variables to be set:

- PORT - The port the Express server should listen on (default: 3000).
- CLIENT_ID - The consumer key given when creating your app.
- CLIENT_SECRET - A consumer secret key given when creating your app.
- SWIFT_API_HOST - The Swift API server host.
- SWIFT_PRIVATE_KEY - The path to your private key file (PEM format).
- SWIFT_CERTIFICATE - The path to your certificate file (PEM format).
- SWIFT_CERTIFICATE_DN - The DN of the SWIFT_CERTIFICATE.

You can create a .env file in the "backend" directory of the project and define the environment variables:
```bash
PORT=3000
CLIENT_ID=yourConsumerKey
CLIENT_SECRET=yourConsumerSecret
SWIFT_API_HOST=api-pilot.swift.com
SWIFT_PRIVATE_KEY=/path/to/privateKey.pem
SWIFT_CERTIFICATE=/path/to/cert.pem
SWIFT_CERTIFICATE_DN="CN=some-cert-dn,O=SWIFT"
```