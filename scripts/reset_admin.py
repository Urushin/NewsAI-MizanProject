import os
from supabase import create_client
from dotenv import load_dotenv

# Charge les clés depuis le .env
load_dotenv()

url = os.environ.get("SUPABASE_URL")
service_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

if not url or not service_key:
    print("❌ Erreur : SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquants dans le .env")
    exit(1)

supabase = create_client(url, service_key)

email = "admin@user.com"
new_password = "AdminPassword123!" # Change-le ici si tu veux

print(f"🔄 Réinitialisation du mot de passe pour {email}...")

# Mise à jour directe de l'utilisateur via l'API Admin de Supabase
res = supabase.auth.admin.update_user_by_id(
    "45d54731-0cba-45ef-af76-8a076f3a4500",
    {"password": new_password}
)

if res.user:
    print(f"✅ Succès ! Tu peux maintenant te connecter avec :")
    print(f"📧 Email : {email}")
    print(f"🔑 Mot de passe : {new_password}")
else:
    print("❌ Échec de la réinitialisation.")
