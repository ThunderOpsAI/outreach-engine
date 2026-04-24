import sys
import json
import os
from anthropic import Anthropic

def classify(scraped_data: dict) -> dict:
    try:
        api_key = os.environ.get("ANTHROPIC_API_KEY")
        if not api_key:
            return {
                "industry": "Unknown",
                "pain_points": [],
                "signals": [],
                "company_summary": "Missing ANTHROPIC_API_KEY"
            }

        client = Anthropic(api_key=api_key)
        
        system_prompt = "You are a B2B intelligence analyst. Return only valid JSON."
        prompt = f"""
Task: classify industry, extract 2-3 pain points, extract signals, and write a company summary based on the scraped data.
Return ONLY valid JSON matching this schema exactly, with no other text or explanation:
{{
  "industry": "string",
  "pain_points": ["string", "string"],
  "signals": ["string", "string"],
  "company_summary": "string"
}}

Scraped data:
{json.dumps(scraped_data, indent=2)}
"""

        response = client.messages.create(
            model="claude-3-haiku-20240307",
            max_tokens=1000,
            system=system_prompt,
            messages=[
                {"role": "user", "content": prompt}
            ]
        )
        
        content = response.content[0].text
        # Strip json fences if present
        if content.startswith("```json"):
            content = content.replace("```json\n", "").replace("```", "")
        elif content.startswith("```"):
            content = content.replace("```\n", "").replace("```", "")
            
        result = json.loads(content.strip())
        
        # Ensure schema
        return {
            "industry": result.get("industry", "Unknown"),
            "pain_points": result.get("pain_points", []),
            "signals": result.get("signals", []),
            "company_summary": result.get("company_summary", "")
        }
    except Exception as e:
        return {
            "industry": "Unknown",
            "pain_points": [],
            "signals": [],
            "company_summary": ""
        }

def main():
    try:
        if len(sys.argv) > 1:
            try:
                input_data = json.loads(sys.argv[1])
            except json.JSONDecodeError:
                input_data = {}
        else:
            input_text = sys.stdin.read()
            input_data = json.loads(input_text)
            
        scraped_data = input_data.get("scraped", {})
        result = classify(scraped_data)
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({
            "industry": "Unknown",
            "pain_points": [],
            "signals": [],
            "company_summary": ""
        }))

if __name__ == "__main__":
    main()
