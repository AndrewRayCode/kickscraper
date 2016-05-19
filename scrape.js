var fs = require('fs');
var request = require('request');
var cheerio = require('cheerio');
var throat = require('throat');
var url = require('url');

function scrapeUrl( url ) {
    
    return new Promise( function( resolve, reject ) {

        request( url, function( error, response, html ) {

            if( error ) {
                return reject( error );
            }

            var $ = cheerio.load( html );

            var title = (
                $('.NS_projects__header h2 a').first().text() ||
                $('.project-profile__title').first().text()
            ).trim();

            var raised = (
                $( '#pledged' ).text() ||
                $( 'h3.mb1 .money' ).text()
            ).trim();
            var goal = (
                $( '.text .money' ).text() ||
                $( 'div.h5 .money' ).text()
            ).trim();

            var $rewards = $('.js-project-rewards ol li');
            var totalRewardCount = $rewards.length;

            var firstRewardText = $('.js-project-rewards ol li .pledge__amount' ).first().text();
            var firstRewardScrape = firstRewardText.match( /Pledge (\S+) or more/ );
            var firstReward = firstRewardScrape ? firstRewardScrape[ 1 ] : '?';
            var firstRewardContent = $('.pledge__reward-description').first().text().replace( /\n/g, ' ' ).replace( /	/g, '');

            var lastRewardText = $('.js-project-rewards ol li .pledge__amount' ).last().text();
            var lastRewardScrape = lastRewardText.match( /Pledge (\S+) or more/ );
            var lastReward = lastRewardScrape ? lastRewardScrape[ 1 ] : '?';
            var lastRewardContent = $('.pledge__reward-description').last().text().replace( /\n/g, ' ' ).replace( /	/g, '');

            var mentionsHtml5 = !!$('#content-wrap').text().match( /html5/i );
            var mentionsWebGl = !!$('#content-wrap').text().match( /webgl/i );

            var raisedNum = parseFloat(
                raised.replace( /[^\d\\\.]/g, '' )
            );
            var totalBackers = parseInt(
                $('.NS_projects__spotlight_stats b').text() ||
                $('div[data-backers-count]').text()
            );
            var averageDonation = '$' + Math.round(
                ( raisedNum / totalBackers ) * 100
            ) / 100;

            resolve({
                title,
                url,
                raised,
                goal,
                totalBackers,
                averageDonation,
                totalRewardCount,
                firstReward,
                firstRewardContent,
                lastReward,
                lastRewardContent,
                mentionsHtml5,
                mentionsWebGl,
            });

        });

    });

}

fs.readFile( './urls', function read( err, data ) {
    if (err) {
        throw err;
    }
    content = data.toString('utf8');

    var urls = Array.from(
        // De-dupe array, see http://stackoverflow.com/questions/1960473/unique-values-in-an-array
        new Set( content.split( '\n' ).filter( u => !!u ) )
    );

    Promise.all( urls.map( throat( process.env.CONCURRENCY || 5, function( http ) {

        var parsed = url.parse( http );

        var basepath = parsed.path.match( /\/[^\/]+\/[^\/]+\/[^\/]+/ );

        if( !basepath ) {
            throw new Error( `Could not parse path ${ http }` );
        }

        var rebuilt = 'https://www.kickstarter.com/' + basepath + '/description';

        console.log( `Scraping ${ rebuilt }...` );
        return scrapeUrl( rebuilt );

    }))).then( function( values ) {

        var content = values.map( function( value ) {

            return [
                value.title,
                value.url,
                value.goal,
                value.raised,
                value.totalBackers,
                value.averageDonation,
                value.totalRewardCount,
                value.firstReward,
                value.firstRewardContent,
                value.lastReward,
                value.lastRewardContent,
                value.mentionsHtml5,
                value.mentionsWebGl,

            ].join( '	' );

        }).join( '\n' );

        return new Promise( function( resolve, reject ) {
            fs.writeFile( './output', content, function( err ) {
                if( err ) {
                    return reject( err );
                }
                console.log('Written to ./output');
                resolve();
            });
        });

    }).catch( function( error ) {

        console.error( 'Error', error );

    });

});
