import os
import json
from supabase import create_client

env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
with open(env_path, "r") as f:
    for line in f:
        if "=" in line and not line.startswith("#"):
            k, v = line.strip().split("=", 1)
            # Remove quotes
            if v.startswith('"') and v.endswith('"'): v = v[1:-1]
            if v.startswith("'") and v.endswith("'"): v = v[1:-1]
            os.environ[k] = v

url = os.environ.get("SUPABASE_URL")
service_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

supabase = create_client(url, service_key)

USERS = [
    {"username": "admin", "email": "admin@user.com", "password": "AdminPassword123!"},
    {"username": "john", "email": "john@user.com", "password": "JohnPassword123!"},
    {"username": "sarah", "email": "sarah@user.com", "password": "SarahPassword123!"},
    {"username": "yuki", "email": "yuki@user.com", "password": "YukiPassword123!"}
]

def load_profile_data(username):
    try:
        with open(f"backend/profiles/{username}.json", "r") as f:
            return json.load(f)
    except Exception as e:
        print(f"⚠️ Impossible de charger le JSON pour {username}: {e}")
        return {}


for user_data in USERS:
    username = user_data["username"]
    email = user_data["email"]
    password = user_data["password"]
    
    print(f"\n🔄 Création/Mise à jour de l'utilisateur {username} ({email})...")
    
    user_id = None
    
    # Try to create user
    try:
        res = supabase.auth.admin.create_user({
            "email": email,
            "password": password,
            "user_metadata": {"username": username},
            "email_confirm": True
        })
        if res.user:
            user_id = res.user.id
            print(f"✅ Utilisateur {username} créé dans auth.users!")
    except Exception as e:
        if "User already registered" in str(e):
            print(f"ℹ️ L'utilisateur {email} existe déjà.")
            # We need to find the user_id somehow... 
            # Subabase client doesn't have an easy get_user_by_email without listing all users
            # Let's list users and find it
        else:
            print(f"❌ Erreur lors de la création de l'utilisateur: {e}")
            
    if not user_id:
        try:
            # fetch users to find ID
            users_res = supabase.auth.admin.list_users()
            for u in users_res:
                if u.email == email:
                    user_id = u.id
                    break
        except Exception as e:
            print(f"❌ Erreur pour récupérer la liste des utilisateurs: {e}")
            
        # Also try to update password
        if user_id:
            try:
                supabase.auth.admin.update_user_by_id(user_id, {"password": password})
                print(f"✅ Mot de passe mis à jour pour {username}")
            except Exception as e:
                print(f"❌ Erreur lors de la mise à jour du mot de passe: {e}")
    
    if user_id:
        # Load profile JSON
        profile_data = load_profile_data(username)
        
        # Prepare data for profiles table
        db_profile = {
            "id": user_id,
            "username": username,
            "language": profile_data.get("identity", {}).get("languages_spoken", ["fr"])[0],
            "score_threshold": 70,
            "identity": profile_data.get("identity", {}),
            "interests": profile_data.get("interests", {}),
            "rejection_rules": profile_data.get("rejection_rules", []),
            "preferences": profile_data.get("preferences", {})
        }
        
        # Try inserting or updating profile
        try:
            res = supabase.table("profiles").upsert(db_profile).execute()
            print(f"✅ Profil mis à jour dans la table profiles pour {username}!")
        except Exception as e:
            print(f"❌ Erreur lors de la mise à jour de la table profiles: {e}")

print("\n🎉 Terminé ! Vous pouvez vous connecter avec les identifiants suivants :")
for u in USERS:
    print(f"- Email: {u['email']} | Mot de passe: {u['password']} (username: {u['username']})")
