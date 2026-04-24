import sys
import json
import asyncio
from scraper import scrape
from classifier import classify

async def run_pipeline(url: str):
    try:
        # Scrape
        scraped_data = await scrape(url)
        
        # If scrape failed, return empty EnrichmentResult
        if "error" in scraped_data:
            return {
                "industry": "Unknown",
                "pain_points": [],
                "signals": [],
                "company_summary": ""
            }
            
        # Classify
        result = classify(scraped_data)
        return result
        
    except Exception as e:
        return {
            "industry": "Unknown",
            "pain_points": [],
            "signals": [],
            "company_summary": ""
        }

async def main():
    try:
        input_text = sys.stdin.read()
        if not input_text:
            if len(sys.argv) > 1:
                input_text = sys.argv[1]
            else:
                input_text = "{}"
                
        input_data = json.loads(input_text)
        url = input_data.get("url")
        
        if not url:
            print(json.dumps({
                "industry": "Unknown",
                "pain_points": [],
                "signals": [],
                "company_summary": ""
            }))
            return
            
        # Hard timeout of 3000ms
        try:
            result = await asyncio.wait_for(run_pipeline(url), timeout=3.0)
        except asyncio.TimeoutError:
            result = {
                "industry": "Unknown",
                "pain_points": [],
                "signals": [],
                "company_summary": ""
            }
            
        print(json.dumps(result))
        
    except Exception as e:
        print(json.dumps({
            "industry": "Unknown",
            "pain_points": [],
            "signals": [],
            "company_summary": ""
        }))

if __name__ == "__main__":
    asyncio.run(main())
