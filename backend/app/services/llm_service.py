import requests
import logging
from typing import List, Optional
import json
import os

logger = logging.getLogger(__name__)

import random

MUSIC_STYLES_LIBRARY = [
    "Cinematic", "Lo-fi", "Synthwave", "Rock", "HipHop", "Orchestral", "Ambient", "Trap", "Techno",
    "Jazz", "Blues", "Country", "Folk", "Reggae", "Soul", "R&B", "Funk", "Disco", "House", "Trance",
    "Dubstep", "Drum & Bass", "Jungle", "Garage", "Grime", "Afrobeats", "K-Pop", "J-Pop", "Indie Pop",
    "Dream Pop", "Shoegaze", "Post-Rock", "Math Rock", "Prog Rock", "Metal", "Punk", "Emo", "Grunge",
    "Acoustic", "Piano", "Classical", "Opera", "Gregorian Chant", "Medieval", "Celtic", "Nordic Folk",
    "Latin", "Salsa", "Bossa Nova", "Reggaeton", "Flamenco", "Tango", "Bollywood", "Indian Classical",
    "Gospel", "Spiritual", "Meditative", "New Age", "Dark Ambient", "Drone", "Noise", "Industrial",
    "Cyberpunk", "Vaporwave", "Chiptune", "Glitch", "IDM", "Complextro", "Electro Swing", "Nu-Disco",
    "Future Bass", "Tropical House", "Deep House", "Tech House", "Acid House", "Psytrance", "Hardstyle",
    "Breakbeat", "Trip-Hop", "Downtempo", "Chillout", "Lounge", "Elevator Music", "Muzak", "Experimental",
    "Avant-Garde", "Musique Concrete", "Minimalism", "Baroque", "Renaissance", "Romantic", "Impressionist"
]

SUPPORTED_LANGUAGES = [
    "English", "Spanish", "French", "German", "Italian", "Portuguese", "Romanian", "Russian",
    "Japanese", "Korean", "Chinese", "Arabic", "Hindi", "Turkish", "Dutch", "Polish",
    "Swedish", "Danish", "Norwegian", "Finnish", "Greek", "Hebrew", "Thai", "Vietnamese"
]

# Default values from environment (can be overridden by settings)
_DEFAULT_OPENROUTER_KEY = os.environ.get("OPENROUTER_API_KEY", "")
_DEFAULT_OLLAMA_HOST = os.environ.get("OLLAMA_HOST", "http://localhost:11434")
_DEFAULT_CUSTOM_API_BASE_URL = os.environ.get("CUSTOM_API_BASE_URL", "")
_DEFAULT_CUSTOM_API_KEY = os.environ.get("CUSTOM_API_KEY", "")
_DEFAULT_CUSTOM_API_MODEL = os.environ.get("CUSTOM_API_MODEL", "")

class LLMService:
    # Configurable settings (can be updated at runtime)
    OLLAMA_BASE_URL = _DEFAULT_OLLAMA_HOST
    OPENROUTER_API_KEY = _DEFAULT_OPENROUTER_KEY
    OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
    # Custom API settings (OpenAI-compatible endpoints like vLLM, LocalAI, LM Studio)
    CUSTOM_API_BASE_URL = _DEFAULT_CUSTOM_API_BASE_URL
    CUSTOM_API_KEY = _DEFAULT_CUSTOM_API_KEY
    CUSTOM_API_MODEL = _DEFAULT_CUSTOM_API_MODEL

    @classmethod
    def update_settings(cls, ollama_host: str = None, openrouter_api_key: str = None,
                       custom_api_base_url: str = None, custom_api_key: str = None,
                       custom_api_model: str = None):
        """Update LLM service settings at runtime."""
        if ollama_host is not None:
            cls.OLLAMA_BASE_URL = ollama_host if ollama_host else _DEFAULT_OLLAMA_HOST
            logger.info(f"[LLM] Updated Ollama host: {cls.OLLAMA_BASE_URL}")
        if openrouter_api_key is not None:
            cls.OPENROUTER_API_KEY = openrouter_api_key
            logger.info(f"[LLM] Updated OpenRouter API key: {'***' + openrouter_api_key[-4:] if openrouter_api_key else '(empty)'}")
        if custom_api_base_url is not None:
            cls.CUSTOM_API_BASE_URL = custom_api_base_url
            logger.info(f"[LLM] Updated Custom API base URL: {cls.CUSTOM_API_BASE_URL or '(empty)'}")
        if custom_api_key is not None:
            cls.CUSTOM_API_KEY = custom_api_key
            logger.info(f"[LLM] Updated Custom API key: {'***' + custom_api_key[-4:] if custom_api_key else '(empty)'}")
        if custom_api_model is not None:
            cls.CUSTOM_API_MODEL = custom_api_model
            logger.info(f"[LLM] Updated Custom API model: {cls.CUSTOM_API_MODEL or '(empty)'}")

    @classmethod
    def get_settings(cls) -> dict:
        """Get current LLM service settings."""
        return {
            "ollama_host": cls.OLLAMA_BASE_URL,
            "openrouter_api_key": cls.OPENROUTER_API_KEY,
            "custom_api_base_url": cls.CUSTOM_API_BASE_URL,
            "custom_api_key": cls.CUSTOM_API_KEY,
            "custom_api_model": cls.CUSTOM_API_MODEL
        }

    @classmethod
    def check_ollama_available(cls) -> bool:
        """Check if Ollama is available."""
        try:
            resp = requests.get(f"{cls.OLLAMA_BASE_URL}/api/tags", timeout=2)
            return resp.status_code == 200
        except:
            return False

    @classmethod
    def check_openrouter_available(cls) -> bool:
        """Check if OpenRouter API key is set."""
        return bool(cls.OPENROUTER_API_KEY)

    @classmethod
    def check_custom_api_available(cls) -> bool:
        """Check if Custom API is configured (base URL and model are required)."""
        return bool(cls.CUSTOM_API_BASE_URL and cls.CUSTOM_API_MODEL)

    @classmethod
    def get_models(cls) -> List[dict]:
        """Returns available models from both Ollama and OpenRouter."""
        models = []

        # Try Ollama first
        try:
            resp = requests.get(f"{cls.OLLAMA_BASE_URL}/api/tags", timeout=2)
            if resp.status_code == 200:
                data = resp.json()
                for model in data.get("models", []):
                    models.append({
                        "id": model["name"],
                        "name": model["name"],
                        "provider": "ollama"
                    })
        except Exception as e:
            logger.warning(f"Failed to fetch Ollama models: {e}")

        # Add OpenRouter models if API key is set
        if cls.OPENROUTER_API_KEY:
            openrouter_models = [
                {"id": "google/gemini-2.0-flash-001", "name": "Gemini 2.0 Flash", "provider": "openrouter"},
                {"id": "anthropic/claude-3.5-sonnet", "name": "Claude 3.5 Sonnet", "provider": "openrouter"},
                {"id": "openai/gpt-4o-mini", "name": "GPT-4o Mini", "provider": "openrouter"},
                {"id": "meta-llama/llama-3.3-70b-instruct", "name": "Llama 3.3 70B", "provider": "openrouter"},
            ]
            models.extend(openrouter_models)

        # Add Custom API model if configured
        if cls.CUSTOM_API_BASE_URL and cls.CUSTOM_API_MODEL:
            models.append({
                "id": cls.CUSTOM_API_MODEL,
                "name": f"Custom: {cls.CUSTOM_API_MODEL}",
                "provider": "custom"
            })

        return models

    @staticmethod
    def get_supported_languages() -> List[str]:
        return SUPPORTED_LANGUAGES

    @classmethod
    def _call_ollama(cls, model: str, prompt: str, json_mode: bool = False, temperature: float = 0.7) -> str:
        """Call Ollama API."""
        payload = {
            "model": model,
            "prompt": prompt,
            "stream": False,
            "options": {"temperature": temperature}
        }
        if json_mode:
            payload["format"] = "json"

        resp = requests.post(
            f"{cls.OLLAMA_BASE_URL}/api/generate",
            json=payload,
            timeout=60
        )
        if resp.status_code == 200:
            return resp.json().get("response", "")
        raise Exception(f"Ollama Error: {resp.text}")

    @classmethod
    def _call_openrouter(cls, model: str, prompt: str, temperature: float = 0.7) -> str:
        """Call OpenRouter API."""
        headers = {
            "Authorization": f"Bearer {cls.OPENROUTER_API_KEY}",
            "Content-Type": "application/json",
            "HTTP-Referer": "http://localhost:5173",
            "X-Title": "HeartMuLa Music"
        }

        payload = {
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": temperature
        }

        resp = requests.post(
            f"{LLMService.OPENROUTER_BASE_URL}/chat/completions",
            headers=headers,
            json=payload,
            timeout=60
        )

        if resp.status_code == 200:
            data = resp.json()
            return data["choices"][0]["message"]["content"]
        raise Exception(f"OpenRouter Error: {resp.status_code} - {resp.text}")

    @classmethod
    def _call_custom_api(cls, model: str, prompt: str, temperature: float = 0.7) -> str:
        """Call a custom OpenAI-compatible API (vLLM, LocalAI, LM Studio, etc.)."""
        headers = {"Content-Type": "application/json"}
        if cls.CUSTOM_API_KEY:
            headers["Authorization"] = f"Bearer {cls.CUSTOM_API_KEY}"

        payload = {
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": temperature
        }

        # Ensure base URL doesn't have trailing slash
        base_url = cls.CUSTOM_API_BASE_URL.rstrip('/')

        resp = requests.post(
            f"{base_url}/chat/completions",
            headers=headers,
            json=payload,
            timeout=60
        )

        if resp.status_code == 200:
            data = resp.json()
            return data["choices"][0]["message"]["content"]
        raise Exception(f"Custom API Error: {resp.status_code} - {resp.text}")

    @classmethod
    def _call_llm(cls, model: str, prompt: str, provider: str = "ollama", json_mode: bool = False, temperature: float = 0.7) -> str:
        """Unified LLM call that routes to appropriate provider."""
        if provider == "openrouter":
            return cls._call_openrouter(model, prompt, temperature)
        elif provider == "custom":
            return cls._call_custom_api(model, prompt, temperature)
        else:
            return cls._call_ollama(model, prompt, json_mode, temperature)

    @staticmethod
    def generate_lyrics(topic: str, model: str = "llama3", seed_lyrics: Optional[str] = None,
                       provider: str = "ollama", language: str = "English") -> dict:
        """Generate lyrics and also suggest a refined topic and musical style."""

        # Build language instruction with diacritics requirement
        if language != "English":
            language_instruction = (
                f"Write the lyrics in {language}. "
                f"IMPORTANT: Use proper diacritics and special characters native to {language}. "
                f"For example: Romanian uses ă, â, î, ș, ț; French uses é, è, ê, ë, ç, à, ù; "
                f"German uses ä, ö, ü, ß; Spanish uses á, é, í, ó, ú, ñ, ü; Portuguese uses ã, õ, ç, á, é, etc. "
                f"Always use the correct native characters, never substitute with ASCII equivalents."
            )
        else:
            language_instruction = ""

        if seed_lyrics and seed_lyrics.strip():
            prompt = (
                f"Continue and complete these song lyrics. Topic/Context: {topic}.\n"
                f"{language_instruction}\n\n"
                f"EXISTING LYRICS (Keep these exactly as is, and append the rest):\n"
                f"'''{seed_lyrics}'''\n\n"
                "RULES:\n"
                "- Keep the existing lyrics at the start\n"
                "- Complete with full song structure using [Intro], [Verse], [Chorus], [Bridge], [Outro] tags\n"
                "- If an artist name is mentioned (Drake, Taylor Swift, Eminem, etc.), match their lyrical style\n"
                "- OUTPUT ONLY THE LYRICS - no explanations, no analysis, no commentary\n"
                "- Start your response directly with [Intro] or the first section tag\n"
            )
        else:
            prompt = (
                f"Write song lyrics about: {topic}\n"
                f"{language_instruction}\n\n"
                "RULES:\n"
                "- Use section tags: [Intro], [Verse], [Verse 2], [Chorus], [Bridge], [Outro]\n"
                "- If an artist name is mentioned (Drake, Taylor Swift, Eminem, Travis Scott, etc.), write in their signature style\n"
                "- OUTPUT ONLY THE LYRICS - absolutely no explanations, analysis, or commentary\n"
                "- Start your response directly with [Intro] or the first section tag\n"
                "- Do not explain what style you're using, just write the lyrics\n"
            )

        try:
            lyrics = LLMService._call_llm(model, prompt, provider)

            # Now generate suggested topic and style based on the lyrics
            style_prompt = (
                f"Based on these song lyrics and the original user request, suggest:\n"
                f"1. A refined, evocative song concept/topic (1 sentence)\n"
                f"2. Musical style tags (3-5 comma-separated tags like genre, mood, tempo, artist-style if applicable)\n\n"
                f"ORIGINAL USER REQUEST: {topic}\n\n"
                f"LYRICS:\n{lyrics[:500]}...\n\n"
                "IMPORTANT: If the user mentioned an artist name (e.g., 'like Drake', 'Taylor Swift style', 'Eminem'), "
                "include that artist's typical genre/style in the tags (e.g., 'Drake-style R&B', 'Taylor Swift Pop', 'Eminem Rap').\n\n"
                "Return ONLY a JSON object with 'topic' and 'tags' keys. No markdown, no explanation.\n"
                'Example: {"topic": "A bittersweet summer romance fading with autumn", "tags": "Pop, Melancholic, Acoustic, Mid-tempo"}\n'
                'Example with artist: {"topic": "Late night confessions in the city", "tags": "Drake-style R&B, Emotional, Melodic, Hip-Hop"}'
            )

            try:
                style_response = LLMService._call_llm(model, style_prompt, provider, json_mode=(provider == "ollama"))
                style_response = style_response.strip()
                if style_response.startswith("```"):
                    style_response = style_response.replace("```json", "").replace("```", "").strip()

                style_data = json.loads(style_response)
                return {
                    "lyrics": lyrics,
                    "suggested_topic": style_data.get("topic", topic),
                    "suggested_tags": style_data.get("tags", "Pop, Melodic")
                }
            except (json.JSONDecodeError, Exception) as e:
                logger.warning(f"Failed to parse style suggestions: {e}")
                return {
                    "lyrics": lyrics,
                    "suggested_topic": topic,
                    "suggested_tags": "Pop, Melodic"
                }

        except Exception as e:
            logger.error(f"Lyrics generation failed: {e}")
            raise e

    @staticmethod
    def generate_title(context: str, model: str = "llama3", provider: str = "ollama") -> str:
        prompt = f"Generate a short, creative, 2-5 word song title based on this concept/lyrics: '{context}'. Return ONLY the title, no quotes or prefix."

        try:
            result = LLMService._call_llm(model, prompt, provider)
            return result.strip().replace('"', '')
        except Exception as e:
            logger.error(f"LLM Auto-Title Exception: {e}")
            return "Untitled Track"

    @staticmethod
    def enhance_prompt(concept: str, model: str = "llama3", provider: str = "ollama") -> dict:
        """
        Takes a simple user concept (e.g. "sad song") and returns a rich JSON object
        with detailed topic description and style tags.
        """
        prompt = (
            f"Act as a professional music producer. Transform this simple user concept into a detailed musical direction.\n"
            f"USER CONCEPT: '{concept}'\n\n"
            "INSTRUCTIONS:\n"
            "1. Create a 'topic' description that is evocative and detailed (1 sentence).\n"
            "2. Select 3-5 'tags' that describe the genre, mood, instruments, and tempo (comma separated).\n"
            "3. Return ONLY a raw JSON object with keys 'topic' and 'tags'. Do NOT wrap in markdown code blocks.\n\n"
            "Example Output:\n"
            '{"topic": "A melancholic acoustic ballad about lost love in autumn.", "tags": "Acoustic, Folk, Sad, Guitar, Slow"}'
        )

        try:
            raw_response = LLMService._call_llm(model, prompt, provider, json_mode=(provider == "ollama"))
            raw_response = raw_response.strip()
            if raw_response.startswith("```json"):
                raw_response = raw_response.replace("```json", "").replace("```", "")

            try:
                return json.loads(raw_response)
            except json.JSONDecodeError:
                logger.warning(f"LLM failed JSON format: {raw_response}")
                return {"topic": concept, "tags": "Pop, Experimental"}
        except Exception as e:
            logger.error(f"Prompt enhancement failed: {e}")
            raise e

    @staticmethod
    def generate_inspiration(model: str = "llama3", provider: str = "ollama") -> dict:
        """
        Generates a random, creative song concept and style.
        """
        prompt = (
            "Act as a professional music producer brainstorming new hit songs.\n"
            "INSTRUCTIONS:\n"
            "1. Invent a UNIQUE, creative song concept/topic (1 vivid sentence).\n"
            "2. Select a matching musical style (3-5 tags like genre, mood, instruments).\n"
            "3. Return ONLY a raw JSON object with keys 'topic' and 'tags'.\n\n"
            "Examples:\n"
            '{"topic": "A lonely astronaut drifting through the cosmos.", "tags": "Ambient, Space, Ethereal"}\n'
            '{"topic": "A cyberpunk detective chasing a suspect in rain.", "tags": "Synthwave, Dark, Retro"}'
        )

        try:
            raw_response = LLMService._call_llm(model, prompt, provider, json_mode=(provider == "ollama"), temperature=0.9)
            raw_response = raw_response.strip()
            if raw_response.startswith("```json"):
                raw_response = raw_response.replace("```json", "").replace("```", "")

            try:
                return json.loads(raw_response)
            except json.JSONDecodeError:
                logger.warning(f"LLM failed JSON format: {raw_response}")
                return {"topic": "A mysterious journey through time", "tags": "Orchestral, Epic, Cinematic"}
        except Exception as e:
            logger.error(f"Inspiration generation failed: {e}")
            raise e

    @staticmethod
    def generate_styles_list(model: str = "llama3") -> List[str]:
        """
        Generates a list of diverse music genres/styles using a static library for instant results.
        Returns 12 random styles.
        """
        try:
            return random.sample(MUSIC_STYLES_LIBRARY, 12)
        except Exception as e:
            logger.error(f"Style generation failed: {e}")
            return MUSIC_STYLES_LIBRARY[:12]
