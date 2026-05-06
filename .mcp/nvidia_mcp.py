import sys
import json
import requests
import os

# Configuration
NVIDIA_API_KEY = os.getenv("NVIDIA_API_KEY")
API_URL = "https://integrate.api.nvidia.com/v1/chat/completions"

# Basic .env support
if not NVIDIA_API_KEY:
    try:
        # Check root of project for .env
        current_dir = os.path.dirname(__file__)
        env_path = os.path.join(os.path.dirname(current_dir), ".env")
        if os.path.exists(env_path):
            with open(env_path, "r") as f:
                for line in f:
                    line = line.strip()
                    if line.startswith("NVIDIA_API_KEY="):
                        NVIDIA_API_KEY = line.split("=", 1)[1].strip()
    except Exception as e:
        sys.stderr.write(f"DEBUG: Error reading .env: {str(e)}\n")

def log(msg):
    sys.stderr.write(f"DEBUG: {msg}\n")
    sys.stderr.flush()

def handle_request(req):
    method = req.get("method")
    params = req.get("params", {})
    
    if method == "initialize":
        return {
            "protocolVersion": "2024-11-05",
            "capabilities": {
                "tools": {
                    "listChanged": False
                }
            },
            "serverInfo": {
                "name": "NVIDIA MCP Server",
                "version": "1.1.0"
            }
        }
    
    if method == "tools/list":
        return {
            "tools": [
                {
                    "name": "ask_nvidia",
                    "description": "Ask a coding or general question to an NVIDIA-hosted model (DeepSeek-V4 Pro by default).",
                    "inputSchema": {
                        "type": "object",
                        "properties": {
                            "prompt": {
                                "type": "string",
                                "description": "The coding question or task description."
                            },
                            "model": {
                                "type": "string",
                                "description": "NVIDIA model name",
                                "default": "deepseek-ai/deepseek-v4-pro"
                            },
                            "reasoning": {
                                "type": "boolean",
                                "description": "Enable reasoning/thinking mode (only for supported models)",
                                "default": True
                            }
                        },
                        "required": ["prompt"]
                    }
                }
            ]
        }
    
    if method == "tools/call":
        tool_name = params.get("name")
        tool_args = params.get("arguments", {})
        
        if tool_name == "ask_nvidia":
            prompt = tool_args.get("prompt")
            model = tool_args.get("model", "deepseek-ai/deepseek-v4-pro")
            use_reasoning = tool_args.get("reasoning", True)
            
            if not NVIDIA_API_KEY:
                return {
                    "content": [{"type": "text", "text": "Error: NVIDIA_API_KEY not found in .env or environment variables."}],
                    "isError": True
                }
            
            try:
                headers = {
                    "Authorization": f"Bearer {NVIDIA_API_KEY}",
                    "Content-Type": "application/json"
                }
                
                payload = {
                    "model": model,
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 0.2,
                    "top_p": 0.95,
                    "max_tokens": 4096
                }
                
                # Add reasoning options if requested
                if use_reasoning:
                    payload["extra_body"] = {
                        "chat_template_kwargs": {
                            "thinking": True,
                            "reasoning_effort": "medium" # Lowered from 'max' to prevent timeouts
                        }
                    }
                
                # Added a 120s timeout to the request itself
                response = requests.post(API_URL, headers=headers, json=payload, timeout=120)
                response.raise_for_status()
                data = response.json()
                
                choice = data['choices'][0]['message']
                content = choice.get('content', '')
                
                # Check for reasoning/thinking fields in response
                reasoning = choice.get('reasoning') or choice.get('reasoning_content')
                
                final_output = ""
                if reasoning:
                    final_output += f"--- REASONING ---\n{reasoning}\n-----------------\n\n"
                final_output += content
                
                return {
                    "content": [{"type": "text", "text": final_output}]
                }
            except Exception as e:
                return {
                    "content": [{"type": "text", "text": f"Error calling NVIDIA API: {str(e)}"}],
                    "isError": True
                }

    return None

def main():
    for line in sys.stdin:
        try:
            req = json.loads(line)
            res_content = handle_request(req)
            
            if res_content is not None:
                response = {
                    "jsonrpc": "2.0",
                    "id": req.get("id"),
                    "result": res_content
                }
                sys.stdout.write(json.dumps(response) + "\n")
                sys.stdout.flush()
        except Exception as e:
            log(f"Error in main loop: {str(e)}")

if __name__ == "__main__":
    main()
