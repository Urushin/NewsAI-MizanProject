import re

def parse_manifesto(text: str) -> dict:
    interests = {}
    current_section = None
    topics = []
    
    for line in text.split("\n"):
        line = line.strip()
        if not line:
            continue
            
        if line.startswith("## Domaines d'intérêt"):
            current_section = "topics"
        elif line.startswith("## Sous-thèmes prioritaires"):
            current_section = "subtopics"
        elif line.startswith("## Notes personnelles"):
            current_section = "custom"
        elif line.startswith("-") and current_section == "topics":
            topic = line[1:].strip()
            interests[topic] = []
            topics.append(topic)
        elif line.startswith("-") and current_section == "subtopics":
            subtopic = line[1:].strip()
            # Just distribute subtopics to the first topic or all? 
            # Or just store them in custom ways?
            if topics:
                interests[topics[0]].append(subtopic)
            else:
                interests["General"] = [subtopic]
        elif current_section == "custom" and not line.startswith("#"):
            if "Notes personnelles" not in interests:
                interests["Notes personnelles"] = []
            interests["Notes personnelles"].append(line)
            
    return interests

test_text = """
# Mon Manifesto Mizan.ai

## Domaines d'intérêt
- Lifestyle & Sport
- Culture & Divertissement

## Sous-thèmes prioritaires
- Football
- Automobile & F1
- Sports de Combat (MMA/Boxe)

## Notes personnelles
Pokemon
Digimon
"""
print(parse_manifesto(test_text))
