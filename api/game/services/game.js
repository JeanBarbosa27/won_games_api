'use strict';

/**
 * Read the documentation (https://strapi.io/documentation/v3.x/concepts/services.html#core-services)
 * to customize this service
 */

const axios = require('axios')
const slugify = require('slugify')
const qs = require('querystring')

function Exception(e) {
  return { e, data: e.data && e.data.errors && e.data.errors };
}

function timeout(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function getGameInfo(slug) {
  try {

    const jsdom = require('jsdom')
    const { JSDOM } = jsdom
    const { data } = await axios.get(`https://www.gog.com/game/${slug}`)
    const dom = new JSDOM(data)

    const ratingElement = dom.window.document.querySelector('.age-restrictions__icon use')
    const descriptionElement = dom.window.document.querySelector('.description')

    return {
      rating: ratingElement
                ? ratingElement
                    .getAttribute('xlink:href')
                    .replace(/_/g, '')
                    .replace(/[^\w-]+/g, '')
                : 'BR0',
      short_description: descriptionElement.textContent.trim().slice(0, 160),
      description: descriptionElement.innerHTML
    }
  } catch(e) {
    console.log('getGameInfo', Exception(e))
  }
}

async function findByName(entityName, registerName) {
  const entity = await strapi.services[entityName].findOne({ name: registerName })
  return entity;
}

async function handleRelationCreation(entityName, registerName) {
  const findRelation = await findByName(entityName, registerName)

  if(!findRelation) {
    await strapi.services[entityName].create({
      name: registerName,
      slug: slugify(registerName, { lower: true })
    })
  }
}

async function createManyToManyData(products) {
  const categories = {}
  const developers = {}
  const platforms = {}
  const publishers = {}

  products.forEach(
    ({ genres, developer, supportedOperatingSystems, publisher }) => {
      genres && genres.forEach(item => categories[item] = true)
      developer && Array.isArray(developer)
        ? developer.forEach(item => developers[item] = true)
        : developers[developer] = true
      supportedOperatingSystems
        && supportedOperatingSystems.forEach(item => platforms[item] = true)
      publishers[publisher] = true
    }
  )

  return Promise.all([
    ...Object.keys(categories).map(
      category => handleRelationCreation('category', category)
    ),
    ...Object.keys(developers).map(
      developer => handleRelationCreation('developer', developer)
    ),
    ...Object.keys(platforms).map(
      platform => handleRelationCreation('platform', platform)
    ),
    ...Object.keys(publishers).map(
      publisher => handleRelationCreation('publisher', publisher)
    ),
  ])
}

async function setImage({ image, game, field = 'cover' }) {
  try {
    const url = `https:${image}_bg_crop_1680x655.jpg`;
    const { data } = await axios.get(url, { responseType: 'arraybuffer' });
    const buffer = Buffer.from(data, 'base64');

    const FormData = require('form-data');
    const formData = new FormData();

    formData.append('refId', game.id);
    formData.append('ref', 'game');
    formData.append('field', field);
    formData.append('files', buffer, { filename: `${game.slug}.jpg` });

    console.info(`Uploading ${field} image: ${game.slug}.jpg`);

    await axios({
      method: 'POST',
      url: `http://${strapi.config.host}:${strapi.config.port}/upload`,
      data: formData,
      headers: {
        'Content-Type': `multipart/form-data; boundary=${formData._boundary}`,
      },
    });
  } catch(e) {
    console.log('setImage', Exception(e))
  }
}

async function createGames(products) {
  await Promise.all(
    products.map(async (product) => {
      const findGame = await findByName('game', product.title)

      if(!findGame) {
        console.log(`Creating game: ${product.title}...`)

        const game = await strapi.services.game.create({
          name: product.title,
          slug: product.slug.replace(/_/g, '-'),
          price: product.price.amount,
          release_date: new Date(Number(
            product.globalReleaseDate) * 1000
          ).toISOString(),
          categories: await Promise.all(
            product.genres.map(name => findByName('category', name))
          ),
          developers: [await findByName('developer', product.developer)],
          platforms: await Promise.all(
            product.supportedOperatingSystems.map(name => findByName('platform', name))
          ),
          publisher: await findByName('publisher', product.publisher),
          ...(await getGameInfo(product.slug))
        })

        await setImage({ image: product.image, game })

        await Promise.all(
          product.gallery.slice(0, 5).map(
            url => setImage({ image: url, game, field: 'gallery' })
          )
        )

        await timeout(2000)

        return game
      }
    })
  )
}

module.exports = {
  populate: async (params) => {
    try {
      console.log('Executing game service...')

      const gogApiUrl = `https://www.gog.com/games/ajax/filtered?mediaType=game&${qs.stringify(params)}`

      const { data : { products } } = await axios.get(gogApiUrl)

      await createManyToManyData(products)
      await createGames(products)
      console.log('Game service done!');
    } catch(e) {
      console.log('Populate', Exception(e));
    }

  }
};
