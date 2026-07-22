import os
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
import google.generativeai as genai

load_dotenv()

API_KEY = os.environ.get("GEMINI_API_KEY")
if not API_KEY:
    print("\nWARNING: GEMINI_API_KEY is not set. Copy .env.example to .env and paste your key in.\n")

genai.configure(api_key=API_KEY or "")

app = Flask(__name__)
CORS(app)

MODEL_NAME = "models/gemini-2.0-flash"


def build_prompt(history):
    lines = []
    for item in history:
        role = item.get("role")
        content = item.get("content", "")
        if role == "assistant":
            lines.append(f"Assistant: {content}")
        else:
            lines.append(f"User: {content}")
    return "\n".join(lines).strip() + "\nAssistant:"


@app.route("/api/chat", methods=["POST"])
def chat():
    try:
        data = request.get_json(force=True)
        history = data.get("history")
        if not isinstance(history, list) or len(history) == 0:
            return jsonify({"error": "history must be a non-empty array"}), 400
        if history[-1].get("role") != "user":
            return jsonify({"error": "the last message must be from the user"}), 400

        prompt = build_prompt(history)
        model = genai.GenerativeModel(MODEL_NAME)
        result = model.generate_content(prompt)

        return jsonify({"text": result.text})
    except Exception as err:
        print(err)
        return jsonify({"error": str(err)}), 500


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 3001))
    print(f"Gemini backend running at http://localhost:{port}")
    app.run(host="0.0.0.0", port=port, debug=True)
