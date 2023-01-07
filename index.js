const https = require('https');
const express = require('express');
const { Configuration, OpenAIApi } = require('openai');
const OPENAI_KEY = process.env.OPENAI_KEY;
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN

const configuration = new Configuration({
	apiKey: OPENAI_KEY,
});

const openai = new OpenAIApi(configuration);

const app = express();
app.use(express.json());

function getMsg(body) {

	try {
		let phone_number_id =
			body.entry[0].changes[0].value.metadata.phone_number_id || "";
		let from = ""
		let msg_body = "";
	
		if (body.entry[0].changes[0].value && body.entry[0].changes[0].value.messages[0]) {
			from = body.entry[0].changes[0].value.messages[0].from || ""; // extract the phone number from the webhook payload
			msg_body = body.entry[0].changes[0].value?.messages[0]?.text?.body || "";
		}
	
		return { phone_number_id, from, msg_body }
	} catch (error) {
		return error
	}
}

async function getCompletion(prompt) {
	let model = "text-davinci-003"
	try {
		const prediction = await openai.createCompletion({
			model: model,
			prompt: prompt,
			max_tokens: 256,
			temperature: 0.5,
		});
	
		return prediction.data.choices[0].text
	} catch (error) {
		console.log("Failed to get completion - ", error.message)
		return error
	}
}

async function sendMessage(msg, from, id) {
	return new Promise((resolve, reject) => {
		// Set up the options for the POST request
		const options = {
			hostname: 'graph.facebook.com',
			// port: 443,
			path: `/v15.0/${id}/messages`,
			method: 'POST',
			headers: {
				'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
				'Content-Type': `application/json`
			}
		};

		// Make the POST request
		const req = https.request(options, (res) => {
			let data = '';

			res.on('data', (chunk) => {
				// Build up the data string as the response comes in
				data += chunk;
			});

			res.on('end', () => {
				// Resolve the promise with the data when the response is complete
				resolve(data);
			});
		});

		req.on('error', (error) => {
			// Reject the promise if there's an error
			reject(error);
		});

		// Write the data you want to send as the request body
		req.write(JSON.stringify({
			messaging_product: "whatsapp",
			to: from,
			// type: "image",
			text: {
				body: msg
			},
			// "image": {
			//     "link": generatedImg,
			//   }
		}));
		req.end();
	});
}

app.post('/webhook', async (req, res) => {
	const body = req.body;

	const { phone_number_id, from, msg_body } = getMsg(body)
	
	if (from && msg_body) {
		let msg = await getCompletion(msg_body)
		let result = await sendMessage(msg, from, phone_number_id);
	}

	// res.send('Yo!')
	res.sendStatus(200);
});

app.get('/webhook', (req, res) => {
	let mode = req.query["hub.mode"];
	let token = req.query["hub.verify_token"];
	let challenge = req.query["hub.challenge"];
	res.send(challenge)
});

app.listen(3000, () => {
	console.log('Server listening on port 3000');
});