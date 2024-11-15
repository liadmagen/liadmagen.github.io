import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { ChevronDown, ChevronRight, BarChart2, Users, Briefcase, Brain, Heart, Rocket, Coffee } from 'lucide-react';

const FeedbackVisualization = () => {
  const [expandedCategory, setExpandedCategory] = useState(null);
  const [expandedSubCategory, setExpandedSubCategory] = useState(null);

  const categories = {
    'Arbeitsplatz & Ausstattung': {
      icon: <Briefcase className="w-5 h-5" />,
      color: 'bg-blue-100 hover:bg-blue-200',
      textColor: 'text-blue-800',
      subCategories: {
        'IT & Hardware': [
          'Leistungsfähige Rechner',
          'Regelmäßige Hard-/Software Updates',
          'Software Support',
          'BIM-Support',
          'Serverzugriff auf der Baustelle'
        ],
        'Büroausstattung': [
          'Höhenverstellbare Tische',
          'Telefonboxen/Rückzugsorte',
          'Trennwände zwischen Arbeitsplätzen',
          'Kopfhörer (Noise cancelling)',
          'Dusche im Büro'
        ]
      }
    },
    'Arbeitskultur & Kommunikation': {
      icon: <Users className="w-5 h-5" />,
      color: 'bg-green-100 hover:bg-green-200',
      textColor: 'text-green-800',
      subCategories: {
        'Positive Aspekte': [
          'Flache Hierarchie',
          'Lockerer Umgang',
          'Positive Kommunikation',
          'Flexible Arbeitszeiten'
        ],
        'Verbesserungspotential': [
          'Besserer Informationsfluss',
          'Klare Kommunikation',
          'Mehr Transparenz',
          'Projektfortschritt kommunizieren'
        ]
      }
    },
    'Weiterbildung & Entwicklung': {
      icon: <Brain className="w-5 h-5" />,
      color: 'bg-purple-100 hover:bg-purple-200',
      textColor: 'text-purple-800',
      subCategories: {
        'Schulungen': [
          'Projektmanagement',
          'Holzbau',
          'Sustainable Architecture',
          'AC-Feinschliff'
        ],
        'Personalentwicklung': [
          'Strukturierte Mitarbeitergespräche',
          'Konstruktives Feedback',
          'Detailliertes Onboarding'
        ]
      }
    },
    'Teambuilding & Events': {
      icon: <Heart className="w-5 h-5" />,
      color: 'bg-red-100 hover:bg-red-200',
      textColor: 'text-red-800',
      subCategories: {
        'Bestehende Events': [
          'Teambuilding',
          'Team-Jourfix',
          'Workshops',
          'Teammeetings'
        ],
        'Neue Vorschläge': [
          'Informelle Stammtische',
          'Architektur Exkursionen',
          'Baustellenbesichtigungen',
          'Mehr wöchentliche Aktivitäten'
        ]
      }
    },
    'Work-Life Balance': {
      icon: <Coffee className="w-5 h-5" />,
      color: 'bg-yellow-100 hover:bg-yellow-200',
      textColor: 'text-yellow-800',
      subCategories: {
        'Gesundheit': [
          'Gesundheitsförderung',
          'Yoga Angebote',
          'Fitness Programme',
          'Massage'
        ],
        'Arbeitszeit': [
          'Flexible Arbeitszeiten',
          'Home Office Möglichkeiten',
          'Kernzeitenregelung'
        ]
      }
    },
    'Zukunftsthemen': {
      icon: <Rocket className="w-5 h-5" />,
      color: 'bg-indigo-100 hover:bg-indigo-200',
      textColor: 'text-indigo-800',
      subCategories: {
        'Innovation': [
          'AI Integration',
          'BIM Implementation',
          '5D-Software',
          'Neue Technologien'
        ],
        'Strategie': [
          '10-15 Jahresplan',
          'AC Spirit Definition',
          'Internationale Ausrichtung',
          'Nachhaltigkeitszertifizierung'
        ]
      }
    }
  };

  return (
    <div className="space-y-4 p-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart2 className="w-6 h-6" />
            Mitarbeiterfeedback Analyse
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Object.entries(categories).map(([category, { icon, color, textColor, subCategories }]) => (
              <div key={category} className="space-y-2">
                <button
                  onClick={() => setExpandedCategory(expandedCategory === category ? null : category)}
                  className={`w-full p-4 rounded-lg ${color} flex items-center justify-between transition-colors duration-200`}
                >
                  <div className="flex items-center gap-3">
                    {icon}
                    <span className={`font-semibold ${textColor}`}>{category}</span>
                  </div>
                  {expandedCategory === category ? 
                    <ChevronDown className="w-5 h-5" /> : 
                    <ChevronRight className="w-5 h-5" />
                  }
                </button>
                
                {expandedCategory === category && (
                  <div className="ml-8 space-y-2">
                    {Object.entries(subCategories).map(([subCategory, items]) => (
                      <div key={subCategory}>
                        <button
                          onClick={() => setExpandedSubCategory(expandedSubCategory === subCategory ? null : subCategory)}
                          className="w-full p-3 rounded-lg bg-gray-50 hover:bg-gray-100 flex items-center justify-between"
                        >
                          <span className="font-medium">{subCategory}</span>
                          {expandedSubCategory === subCategory ? 
                            <ChevronDown className="w-4 h-4" /> : 
                            <ChevronRight className="w-4 h-4" />
                          }
                        </button>
                        
                        {expandedSubCategory === subCategory && (
                          <div className="ml-6 mt-2 space-y-1">
                            {items.map((item, index) => (
                              <div key={index} className="p-2 bg-white rounded border border-gray-100">
                                {item}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default FeedbackVisualization;
