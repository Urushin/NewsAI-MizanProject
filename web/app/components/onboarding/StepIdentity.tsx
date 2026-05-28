"use client";

import { motion } from "framer-motion";
import { Radar } from "lucide-react";
import { wizardLabels } from "../../config/translations";
import { useAuth } from "../../context/AuthContext";
import { TRANSITIONS } from "../../config/constants";

interface StepIdentityProps {
  ageRange: string;
  setAgeRange: (val: string) => void;
  exactAge: string;
  setExactAge: (val: string) => void;
  location: string;
  setLocation: (val: string) => void;
  exactLocation: string;
  setExactLocation: (val: string) => void;
  occupation: string;
  setOccupation: (val: string) => void;
  exactOccupation: string;
  setExactOccupation: (val: string) => void;
}

const AGE_RANGES = ["- de 18", "18-25", "26-35", "36-50", "50+"];

const COUNTRIES = [
  "France", "Belgique", "Suisse", "Canada", "Luxembourg", "Maroc", "Algérie", "Tunisie", 
  "Sénégal", "Côte d'Ivoire", "Cameroun", "Royaume-Uni", "États-Unis", "Allemagne", 
  "Espagne", "Italie", "Portugal", "---", "Afghanistan", "Afrique du Sud", "Albanie", "Andorre", "Angola", "Antigua-et-Barbuda", 
  "Arabie Saoudite", "Argentine", "Arménie", "Australie", "Autriche", "Azerbaïdjan", 
  "Bahamas", "Bahreïn", "Bangladesh", "Barbade", "Bénin", "Bhoutan", "Biélorussie", 
  "Birmanie", "Bolivie", "Bosnie-Herzégovine", "Botswana", "Brésil", "Brunei", 
  "Bulgarie", "Burkina Faso", "Burundi", "Cambodge", "Cap-Vert", "Chili", "Chine", 
  "Chypre", "Colombie", "Comores", "Congo", "Corée du Nord", "Corée du Sud", "Costa Rica", 
  "Croatie", "Cuba", "Danemark", "Djibouti", "Dominique", "Égypte", "Émirats Arabes Unis", 
  "Équateur", "Érythrée", "Estonie", "Eswatini", "Éthiopie", "Fidji", "Finlande", "Gabon", 
  "Gambie", "Géorgie", "Ghana", "Grèce", "Grenade", "Guatemala", "Guinée", "Guinée équatoriale", 
  "Guinée-Bissau", "Guyana", "Haïti", "Honduras", "Hongrie", "Inde", "Indonésie", "Irak", 
  "Iran", "Irlande", "Islande", "Israël", "Jamaïque", "Japon", "Jordanie", "Kazakhstan", 
  "Kenya", "Kirghizistan", "Kiribati", "Koweït", "Laos", "Lesotho", "Lettonie", "Liban", 
  "Libéria", "Libye", "Liechtenstein", "Lituanie", "Macédoine du Nord", "Madagascar", "Malaisie", 
  "Malawi", "Maldives", "Mali", "Malte", "Maurice", "Mauritanie", "Mexique", "Micronésie", 
  "Moldavie", "Monaco", "Mongolie", "Monténégro", "Mozambique", "Namibie", "Nauru", "Népal", 
  "Nicaragua", "Niger", "Nigeria", "Norvège", "Nouvelle-Zélande", "Oman", "Ouganda", "Ouzbékistan", 
  "Pakistan", "Palaos", "Palestine", "Panama", "Papouasie-Nouvelle-Guinée", "Paraguay", "Pays-Bas", 
  "Pérou", "Philippines", "Pologne", "Qatar", "République Centrafricaine", "République Dominicaine", 
  "République Tchèque", "Roumanie", "Russie", "Rwanda", "Saint-Christophe-et-Niévès", "Sainte-Lucie", 
  "Saint-Marin", "Saint-Vincent-et-les-Grenadines", "Salomon", "Salvador", "Samoa", "Sao Tomé-et-Principe", 
  "Serbie", "Seychelles", "Sierra Leone", "Singapour", "Slovaquie", "Slovénie", "Somalie", "Soudan", 
  "Soudan du Sud", "Sri Lanka", "Suède", "Suriname", "Syrie", "Tadjikistan", "Taïwan", "Tanzanie", 
  "Tchad", "Thaïlande", "Timor oriental", "Togo", "Tonga", "Trinité-et-Tobago", "Turkménistan", 
  "Turquie", "Tuvalu", "Ukraine", "Uruguay", "Vanuatu", "Vatican", "Venezuela", "Viêt Nam", 
  "Yémen", "Zambie", "Zimbabwe"
];

const SECTORS = [
  "Tech & Numérique", "Finance & Économie", "Santé & Médical", "Enseignement & Recherche", 
  "Commerce & Vente", "Artisanat & Industrie", "Art, Culture & Médias", "Étudiant", 
  "Droit & Juridique", "Immobilier", "Restauration & Tourisme", "Transport & Logistique", "Autre"
];

export default function StepIdentity({
  ageRange, setAgeRange, exactAge, setExactAge,
  location, setLocation, exactLocation, setExactLocation,
  occupation, setOccupation, exactOccupation, setExactOccupation
}: StepIdentityProps) {
  const { user } = useAuth();
  const w = wizardLabels[user?.language || "fr"] || wizardLabels.en;

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={TRANSITIONS.fade}>
      <div className="flex flex-col gap-2 mb-8">
        <h3 className="text-2xl font-[850] text-zinc-900 font-serif lowercase italic">{w.step3}</h3>
      </div>
      
      <div className="mb-10 p-6 bg-zinc-50 border border-zinc-200">
        <p className="text-[13px] text-zinc-600 leading-relaxed font-serif italic">
          {w.step3Sub}
        </p>
      </div>

      <div className="space-y-12">
        {/* Age Section */}
        <div className="space-y-4">
          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 block border-b border-zinc-100 pb-2">{w.age}</label>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
                <select
                  value={ageRange}
                  onChange={(e) => { setAgeRange(e.target.value); if (e.target.value) setExactAge(""); }}
                  className="w-full px-4 py-2 text-[14px] border border-zinc-200 bg-white focus:outline-none focus:border-zinc-900 font-serif italic h-10 appearance-none cursor-pointer"
                >
                  <option value="">Tranche d'âge...</option>
                  {AGE_RANGES.map(range => (
                     <option key={range} value={range}>{range} {w.years}</option>
                  ))}
                </select>
            </div>
            <input
              type="number"
              placeholder={w.agePlaceholder}
              value={exactAge}
              onChange={(e) => { setExactAge(e.target.value); if (e.target.value) setAgeRange(""); }}
              className="px-5 py-2 text-[13px] border border-zinc-200 bg-transparent focus:outline-none focus:border-zinc-900 flex-1 h-10 font-serif italic"
            />
          </div>
        </div>

        {/* Location Section */}
        <div className="space-y-4">
          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 block border-b border-zinc-100 pb-2">{w.location}</label>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
                <select
                  value={location}
                  onChange={(e) => { setLocation(e.target.value); }}
                  className="w-full px-4 py-2 text-[14px] border border-zinc-200 bg-white focus:outline-none focus:border-zinc-900 font-serif italic h-10 appearance-none cursor-pointer"
                >
                  <option value="">Sélectionner un pays...</option>
                  {COUNTRIES.map(loc => (
                     <option key={loc} value={loc} disabled={loc === "---"}>{loc}</option>
                  ))}
                </select>
            </div>
            <input
              type="text"
              placeholder="Ville ou Région (ex: Lyon, Wallonie...)"
              value={exactLocation}
              onChange={(e) => setExactLocation(e.target.value)}
              className="px-5 py-2 text-[13px] border border-zinc-200 bg-transparent focus:outline-none focus:border-zinc-900 flex-1 h-10 font-serif italic"
            />
          </div>
        </div>

        {/* Occupation Section */}
        <div className="space-y-4">
          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 block border-b border-zinc-100 pb-2">{w.occupation}</label>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
                <select
                  value={occupation}
                  onChange={(e) => { setOccupation(e.target.value); }}
                  className="w-full px-4 py-2 text-[14px] border border-zinc-200 bg-white focus:outline-none focus:border-zinc-900 font-serif italic h-10 appearance-none cursor-pointer"
                >
                  <option value="">Secteur d'activité...</option>
                  {SECTORS.map(occ => (
                     <option key={occ} value={occ}>{occ}</option>
                  ))}
                </select>
            </div>
            <input
              type="text"
              placeholder={w.occupationPlaceholder}
              value={exactOccupation}
              onChange={(e) => setExactOccupation(e.target.value)}
              className="px-5 py-2 text-[13px] border border-zinc-200 bg-transparent focus:outline-none focus:border-zinc-900 flex-1 h-10 font-serif italic"
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
}
