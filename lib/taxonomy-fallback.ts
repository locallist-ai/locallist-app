// Static snapshot of the taxonomy seed. Used as offline fallback on first run.
// Keep in sync with PlaceTaxonomy.SubcategoriesByCategory seed in the migration.

export const TAXONOMY_FALLBACK = {
  categories: ['Food', 'Nightlife', 'Coffee', 'Outdoors', 'Wellness', 'Culture', 'Shopping'],
  subcategoriesByCategory: {
    Food: ['ramen', 'sushi', 'italian', 'pizza', 'mexican', 'tacos', 'cuban', 'latin-american', 'american', 'steakhouse', 'seafood', 'mediterranean', 'asian-fusion', 'brunch', 'bakery', 'vegan'],
    Nightlife: ['pub', 'cocktail-bar', 'speakeasy', 'rooftop-bar', 'wine-bar', 'sports-bar', 'beer-bar', 'nightclub', 'live-music'],
    Coffee: ['specialty-coffee', 'espresso-bar', 'bakery-cafe', 'tea-house', 'juice-bar', 'dessert'],
    Outdoors: ['beach', 'park', 'garden', 'trail', 'marina', 'pier', 'waterfront', 'dog-park'],
    Wellness: ['spa', 'pilates', 'yoga', 'gym', 'sauna', 'iv-therapy', 'massage', 'salt-cave'],
    Culture: ['museum', 'gallery', 'theater', 'music-venue', 'festival-site', 'historic-site', 'public-art', 'cultural-center'],
    Shopping: ['boutique', 'vintage', 'bookstore', 'record-store', 'concept-store', 'market', 'florist', 'designer'],
  },
  labels: {
    en: {
      'Food.ramen': 'Ramen', 'Food.sushi': 'Sushi', 'Food.italian': 'Italian', 'Food.pizza': 'Pizza', 'Food.mexican': 'Mexican', 'Food.tacos': 'Tacos', 'Food.cuban': 'Cuban', 'Food.latin-american': 'Latin American', 'Food.american': 'American', 'Food.steakhouse': 'Steakhouse', 'Food.seafood': 'Seafood', 'Food.mediterranean': 'Mediterranean', 'Food.asian-fusion': 'Asian Fusion', 'Food.brunch': 'Brunch', 'Food.bakery': 'Bakery', 'Food.vegan': 'Vegan',
      'Nightlife.pub': 'Pub', 'Nightlife.cocktail-bar': 'Cocktail Bar', 'Nightlife.speakeasy': 'Speakeasy', 'Nightlife.rooftop-bar': 'Rooftop Bar', 'Nightlife.wine-bar': 'Wine Bar', 'Nightlife.sports-bar': 'Sports Bar', 'Nightlife.beer-bar': 'Beer Bar', 'Nightlife.nightclub': 'Nightclub', 'Nightlife.live-music': 'Live Music',
      'Coffee.specialty-coffee': 'Specialty Coffee', 'Coffee.espresso-bar': 'Espresso Bar', 'Coffee.bakery-cafe': 'Bakery Cafe', 'Coffee.tea-house': 'Tea House', 'Coffee.juice-bar': 'Juice Bar', 'Coffee.dessert': 'Dessert',
      'Outdoors.beach': 'Beach', 'Outdoors.park': 'Park', 'Outdoors.garden': 'Garden', 'Outdoors.trail': 'Trail', 'Outdoors.marina': 'Marina', 'Outdoors.pier': 'Pier', 'Outdoors.waterfront': 'Waterfront', 'Outdoors.dog-park': 'Dog Park',
      'Wellness.spa': 'Spa', 'Wellness.pilates': 'Pilates', 'Wellness.yoga': 'Yoga', 'Wellness.gym': 'Gym', 'Wellness.sauna': 'Sauna', 'Wellness.iv-therapy': 'IV Therapy', 'Wellness.massage': 'Massage', 'Wellness.salt-cave': 'Salt Cave',
      'Culture.museum': 'Museum', 'Culture.gallery': 'Gallery', 'Culture.theater': 'Theater', 'Culture.music-venue': 'Music Venue', 'Culture.festival-site': 'Festival Site', 'Culture.historic-site': 'Historic Site', 'Culture.public-art': 'Public Art', 'Culture.cultural-center': 'Cultural Center',
      'Shopping.boutique': 'Boutique', 'Shopping.vintage': 'Vintage', 'Shopping.bookstore': 'Bookstore', 'Shopping.record-store': 'Record Store', 'Shopping.concept-store': 'Concept Store', 'Shopping.market': 'Market', 'Shopping.florist': 'Florist', 'Shopping.designer': 'Designer',
    },
    es: {
      'Food.ramen': 'Ramen', 'Food.sushi': 'Sushi', 'Food.italian': 'Italiana', 'Food.pizza': 'Pizza', 'Food.mexican': 'Mexicana', 'Food.tacos': 'Tacos', 'Food.cuban': 'Cubana', 'Food.latin-american': 'Latinoamericana', 'Food.american': 'Americana', 'Food.steakhouse': 'Asador', 'Food.seafood': 'Mariscos', 'Food.mediterranean': 'Mediterránea', 'Food.asian-fusion': 'Fusión Asiática', 'Food.brunch': 'Brunch', 'Food.bakery': 'Panadería', 'Food.vegan': 'Vegana',
      'Nightlife.pub': 'Pub', 'Nightlife.cocktail-bar': 'Coctelería', 'Nightlife.speakeasy': 'Speakeasy', 'Nightlife.rooftop-bar': 'Bar en Azotea', 'Nightlife.wine-bar': 'Bar de Vinos', 'Nightlife.sports-bar': 'Bar Deportivo', 'Nightlife.beer-bar': 'Bar de Cervezas', 'Nightlife.nightclub': 'Discoteca', 'Nightlife.live-music': 'Música en Directo',
      'Coffee.specialty-coffee': 'Café de Especialidad', 'Coffee.espresso-bar': 'Cafetería Espresso', 'Coffee.bakery-cafe': 'Café Panadería', 'Coffee.tea-house': 'Salón de Té', 'Coffee.juice-bar': 'Bar de Zumos', 'Coffee.dessert': 'Postres',
      'Outdoors.beach': 'Playa', 'Outdoors.park': 'Parque', 'Outdoors.garden': 'Jardín', 'Outdoors.trail': 'Senda', 'Outdoors.marina': 'Marina', 'Outdoors.pier': 'Muelle', 'Outdoors.waterfront': 'Paseo Marítimo', 'Outdoors.dog-park': 'Parque Canino',
      'Wellness.spa': 'Spa', 'Wellness.pilates': 'Pilates', 'Wellness.yoga': 'Yoga', 'Wellness.gym': 'Gimnasio', 'Wellness.sauna': 'Sauna', 'Wellness.iv-therapy': 'Terapia IV', 'Wellness.massage': 'Masaje', 'Wellness.salt-cave': 'Cueva de Sal',
      'Culture.museum': 'Museo', 'Culture.gallery': 'Galería', 'Culture.theater': 'Teatro', 'Culture.music-venue': 'Sala de Música', 'Culture.festival-site': 'Recinto de Festivales', 'Culture.historic-site': 'Lugar Histórico', 'Culture.public-art': 'Arte Público', 'Culture.cultural-center': 'Centro Cultural',
      'Shopping.boutique': 'Boutique', 'Shopping.vintage': 'Vintage', 'Shopping.bookstore': 'Librería', 'Shopping.record-store': 'Tienda de Discos', 'Shopping.concept-store': 'Concept Store', 'Shopping.market': 'Mercado', 'Shopping.florist': 'Floristería', 'Shopping.designer': 'Diseñador',
    },
  },
} as const;

export type TaxonomyData = {
  categories: string[];
  subcategoriesByCategory: Record<string, string[]>;
  labels: { en: Record<string, string>; es: Record<string, string> };
};
