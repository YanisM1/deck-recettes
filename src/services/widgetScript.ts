export function buildWidgetScript(
  origin: string,
  code: string,
  supabaseUrl: string,
  apiKey: string,
) {
  return `// DeckChef — collez ce script dans Scriptable, puis ajoutez son widget.
// Ce code contient l'accès privé à votre carnet : conservez-le pour vous.
const APP = ${JSON.stringify(origin)};
const CODE = ${JSON.stringify(code)};
const SUPABASE = ${JSON.stringify(supabaseUrl)};
const APIKEY = ${JSON.stringify(apiKey)};
let data;
try {
  const req = new Request(APP + '/api/widget-status');
  req.headers = {'x-deckchef-key': CODE}; req.timeoutInterval = 10;
  data = await req.loadJSON();
  if (data.error || typeof data.total !== 'number') throw Error('Unavailable');
} catch (_) {
  // Accès direct au même carnet si le service du widget est indisponible.
  try {
    const req = new Request(SUPABASE + '/rest/v1/recipes?select=id,title,category&order=created_at.asc,id.asc&limit=1000');
    req.headers = {apikey: APIKEY, 'x-deckchef-key': CODE}; req.timeoutInterval = 10;
    const rows = await req.loadJSON(); if (!Array.isArray(rows)) throw Error('Unavailable');
    const recipe = rows.length ? rows[Math.floor(Date.now()/86400000) % rows.length] : null;
    if (recipe) {
      const detail = new Request(SUPABASE + '/rest/v1/recipes?select=image_url,ingredients,steps&id=eq.' + encodeURIComponent(recipe.id));
      detail.headers = {apikey: APIKEY, 'x-deckchef-key': CODE}; detail.timeoutInterval = 10;
      const details = await detail.loadJSON();
      if (details[0]) Object.assign(recipe, details[0], {ingredients_count:details[0].ingredients.length});
    }
    data = {total:rows.length,recipe,app_url:APP + (recipe ? '/?recipe=' + encodeURIComponent(recipe.id) : '/')};
  } catch (_) {data = {total:0,recipe:null,error:true,app_url:APP};}
}
const widget = new ListWidget();
widget.backgroundColor = Color.dynamic(new Color('#faf6f0'), new Color('#1e1e2e'));
widget.setPadding(16,16,16,16); widget.url = data.app_url || APP;
const ink = Color.dynamic(new Color('#36342f'),new Color('#f7f0df'));
const brand = widget.addText('DECKCHEF'); brand.font = Font.boldSystemFont(10); brand.textColor = new Color('#e07a5f');
widget.addSpacer(10);
const content = widget.addStack(); content.centerAlignContent();
if (data.recipe && data.recipe.image_url && config.widgetFamily !== 'small') {
  try {
    let image; const src = data.recipe.image_url;
    if (src.startsWith('data:image/jpeg;base64,')) image = Image.fromData(Data.fromBase64String(src.split(',')[1]));
    else {
      const photos = {'/photos/salad.jpg':'photo-1512621776951-a57141f2eefd','/photos/pasta.jpg':'photo-1473093295043-cdd812d0e601','/photos/pancakes.jpg':'photo-1528207776546-365bb710ee93','/photos/cookies.jpg':'photo-1499636136210-6f4ee915583e'};
      const photoURL = photos[src] ? 'https://images.unsplash.com/' + photos[src] + '?w=240&q=70&fit=crop&auto=format' : (src.startsWith('/') ? APP+src : src);
      if (!photoURL.startsWith('https://')) throw Error('Invalid image');
      const photoRequest = new Request(photoURL); photoRequest.timeoutInterval = 5; image = await photoRequest.loadImage();
    }
    const picture = content.addImage(image); picture.imageSize = new Size(84,84); picture.cornerRadius = 12; picture.applyFillingContentMode(); content.addSpacer(14);
  } catch (_) {}
}
const text = content.addStack(); text.layoutVertically();
const title = text.addText(data.recipe ? data.recipe.title : data.error ? 'Votre carnet est hors ligne.' : 'Une nouvelle recette vous attend.');
title.font = Font.boldSystemFont(18); title.textColor = ink; title.lineLimit = 3; title.minimumScaleFactor = 0.75;
text.addSpacer(7);
const subtitle = text.addText(data.recipe ? (data.recipe.category === 'sale' ? 'Salé' : 'Sucré') + ' · ' + (data.recipe.ingredients_count || 0) + ' ingrédients' : 'Ouvrir DeckChef');
subtitle.font = Font.systemFont(11); subtitle.textColor = ink; subtitle.textOpacity = 0.65;
widget.addSpacer();
const footer = widget.addText(data.total + (data.total > 1 ? ' recettes à savourer' : ' recette à savourer'));
footer.font = Font.systemFont(9); footer.textColor = ink; footer.textOpacity = 0.5;
widget.refreshAfterDate = new Date(Date.now()+60*60*1000);
if (!config.runsInWidget) await widget.presentMedium();
Script.setWidget(widget); Script.complete();
`;
}
