const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'keywords-data.txt');

const more = `jewish onesies\t16996\t-1
jewish grandma\t16989\t-1
jewish menorah\t16946\t-1
jewish shirts\t16769\t-1
jewish magnet\t16764\t-1
jewish coffee\t16759\t-1
jewish temple\t16501\t-1
jewish candle\t16499\t-1
jewish prayer\t16497\t-1
jewish tshirt\t16480\t-1
jewish charms\t16474\t-1
jewish poster\t16468\t-1
jewish amulet\t16458\t-1
jewish fabric\t16457\t-1
modern jewish\t16447\t-1
jewish shirt\t16183\t-1
jewish hamsa\t16160\t-1
jewish decor\t15914\t-1
jewish charm\t15878\t-1
jewish pins\t15436\t-1
jewish kids\t15422\t-1
jewish baby\t15411\t-1
jewish flag\t15404\t-1
jewish name\t15388\t-1
jewish home\t15175\t-1
jewish toys\t15173\t-1
jewish food\t15158\t-1
jewish mug\t14499\t-1
jewish hat\t14536\t-1
jewish man\t14537\t-1
jewish men\t14280\t-1
jewish dog\t14273\t-1
jewish svg\t14269\t-1
jewish mom\t14257\t-1
jewish bag\t11091\t-1
jewish cat\t11304\t-1
jewish png\t14544\t-1
cz star of david\t131306\t2113
naja star of david\t68442\t1207
megemaria star of david\t47164\t1216
star of david necklace\t46402\t23565
star of david\t43722\t51713
star of david bracelet\t27010\t-1
star of david earrings\t27002\t-1
star of david pendant\t26878\t-1
star of david ring\t25960\t-1
star of david men\t25798\t-1
hamsa star of david\t21776\t-1
opal star of david\t21667\t-1
big star of david\t21434\t-1
mens star of david\t18433\t-1
tiny star of david\t18419\t-1
small star of david\t16342\t-1
gold star of david\t15999\t-1
mini star of david\t16009\t-1
modern star of david\t16247\t-1
large star of david\t14760\t-1
silver star of david\t14708\t-1
dainty star of david\t14700\t-1
diamond star of david\t13824\t-1
blue star of david\t13273\t-1
wooden star of david\t13519\t-1
vintage star of david\t12724\t-1
sterling star of david\t12822\t-1
minimalist star of david\t12001\t-1
star of david svg\t11836\t-1
star of david jewelry\t11413\t-1
star of david shirt\t11308\t-1
star of david art\t10954\t-1
star of david necklace gold\t16858\t-1
gold star of david necklace\t16834\t-1
star of david necklace men\t22314\t-1
star of david charm\t21785\t-1
star of david earring\t21702\t-1
star of david charms\t21967\t-1
star of david mens necklace\t27346\t-1
star of david necklaces\t27088\t-1
star of david cross\t11114\t-1
star of david hamsa\t11099\t-1
star of david ornament\t11490\t-1
star of david stickers\t11512\t-1
star of david bracelet for women\t11725\t-1
star of david bracelet for men\t11716\t-1
star of david cookie cutter\t11426\t-1
star of david gold\t16242\t-1
star of david silver\t11375\t-1
star of david diamond\t11428\t-1
14k gold star of david necklace\t11439\t-1
star of david ring gold\t11559\t-1
star of david ring men\t11302\t-1
star of david chain\t11289\t-1
star of david decor\t11297\t-1
star of david beads\t11293\t-1
star of david pin\t10962\t-1
star of david quilt\t11092\t-1
star of david candle\t11035\t-1
star of david bracelet gold\t11627\t-1
star of david pendant gold\t11441\t-1
star of david pendant silver\t11506\t-1
star of david for men\t11420\t-1
jewish star of david\t12224\t-1
magen david necklace\t46882\t7011
magen david gold necklace\t34713\t4874
magen david necklace silver\t22484\t-1
magen david necklace men\t21920\t-1
gold magen david necklace\t18819\t-1
magen david necklace boys\t12296\t-1
mogen david necklace\t46899\t1277
mogen david\t41588\t1383
star david necklace\t45851\t23564
star david\t39159\t51697
star david earrings\t26543\t-1
star david bracelet\t26142\t-1
star david ring\t25494\t-1
david star necklace\t21834\t-1
david star\t17260\t-1
mkm pottery david star\t69110\t963
am yisrael chai necklace\t138545\t1801
am yisrael chai\t128930\t4172
am israel chai\t128884\t4172
yisrael chai\t63392\t4430
chai necklace made in israel\t47508\t1628
chai necklace bar mitzvah\t46718\t2073
chai necklace silver\t46155\t4224
chai necklace\t42951\t6586
chai pendant\t42640\t5317
chai necklace gold\t26393\t-1
chai necklace men\t26209\t3620
chai necklace women\t26152\t-1
gold chai necklace\t25942\t-1
chai bracelet\t24409\t-1
chai jewelry\t23278\t-1
chai hebrew\t22330\t-1
chai sweatshirt\t25055\t-1
chai pendant gold\t21395\t-1
tiny chai necklace\t21302\t-1
diamond chai\t14160\t-1
hebrew chai necklace\t16588\t-1
jewish chai necklace\t16258\t-1
aryeh nachum judaica\t67482\t1081
judaica jewelry\t67038\t20960
judaica art\t62246\t30451
judaica\t52565\t70737
judaica home decor\t46361\t36945
judaica wall art\t44801\t18396
judaica decor\t43648\t39035
judaica gifts\t43602\t55044
judaica gift\t42584\t55089
judaica necklace\t33297\t15300
judaica painting\t32818\t4176
judaica earrings\t32748\t2194
judaica ring\t30810\t3201
judaica bracelet\t25452\t3409
judaica israel\t25040\t32133
judaica silver\t15139\t-1
modern judaica\t15121\t-1
vintage judaica\t13993\t-1
hafrashat challah\t45989\t1126
challah covers\t44514\t2456
challah boards\t44420\t2214
challah cover\t43578\t-1
challah board\t42946\t2907
challah\t32323\t-1
challah plate\t31581\t-1
challah bread\t24425\t-1
challah tray\t23314\t-1
challah necklace\t21141\t-1
challah art\t18311\t-1
challah shirt\t14695\t-1
shabbat candle holder\t46882\t2765
shabbat candle sticks\t46836\t1262
shabbat candlestick\t46549\t1762
shabbat candles\t45288\t3803
shabbat\t31791\t-1
shabbat shalom\t25009\t-1
shabbat gifts\t23986\t-1
shabbat tray\t23728\t-1
shabbat set\t22343\t-1
shabbat decor\t14426\t-1
shabbat art\t13435\t-1
shabbat gift\t14184\t-1
israeli jewelry\t131491\t36359
israeli art\t115829\t37941
israeli\t94518\t100630
hebrew israeli\t65251\t4796
israeli necklace\t21137\t-1
israeli bracelet\t21167\t-1
israeli ring\t19127\t-1
israeli flag\t19087\t-1
israeli earrings\t15771\t-1
israeli designer\t15515\t-1
israeli wall art\t15509\t-1
israeli jewelry designer\t16445\t-1
hebrew bracelets\t66281\t4846
hebrew names\t64323\t21492
hebrew name necklace\t46098\t11497
hebrew necklace\t45268\t19390
hebrew bracelet\t44437\t4694
hebrew letters\t43685\t4966
hebrew rings\t42607\t4893
hebrew ring\t41596\t4913
hebrew name\t41572\t21514
hebrew\t28374\t-1
hebrew jewelry\t16954\t-1
hebrew art\t14274\t-1
hebrew calendar\t17368\t-1
hebrew blessing\t15246\t-1
shema israel bracelet\t46966\t1447
shema bracelet\t44411\t1441
shema necklace\t43739\t1720
shema wall art\t43703\t1687
shema israel\t41868\t2687
shema ring\t39906\t1375
shema art\t38032\t1753
shema\t23046\t-1
shema yisrael\t19510\t-1
shema jewelry\t31091\t-1
mitzvah\t51610\t-1
bar mitzvah\t29720\t-1
bat mitzvah\t29773\t-1
bar mitzvah gift\t32782\t-1
bat mitzvah gift\t32764\t-1
bar mitzvah card\t33342\t-1
bat mitzvah card\t33377\t-1
bar mitzvah invitation\t34546\t-1
bat mitzvah invitation\t34509\t-1
bat mitzvah gifts\t33511\t-1
bar mitzvah gifts\t32941\t-1
bar mitzvah favors\t25931\t4231
bat mitzvah necklace\t12220\t-1
bat mitzvah bracelet\t11979\t-1
hanukkah t shirts\t46070\t7855
hanukkah menorah\t44772\t-1
hanukkah gifts\t43628\t-1
hanukkah shirt\t43711\t-1
hanukkah ornament\t45282\t-1
hanukkah svg\t42544\t-1
hanukkah art\t41838\t-1
hanukkah\t34743\t-1
hanukkah decor\t13666\t-1
hanukkah cards\t13693\t-1
hanukkah wreath\t13781\t-1
hanukkah sweater\t14016\t-1
passover\t24142\t-1
passover seder plate\t33723\t-1
passover shirt\t31823\t2298
passover art\t30281\t-1
passover table runner\t34507\t1254
passover decor\t13459\t-1
12 tribes of israel\t25524\t2263
12 tribes of israel jewelry\t47390\t1417
12 tribes of israel bracelet\t46692\t1179
12 tribes of israel pendant\t47517\t1303
kosher mezuzah scroll\t67946\t1756
mezuzah with scroll\t67665\t6261
mezuzah for door\t67500\t2988
mezuzah wedding\t67139\t3599
mezuzah necklace\t66493\t-1
kosher mezuzah\t66425\t-1
mezuzah scroll\t66247\t-1
mezuzah cases\t65503\t-1
mezuzah case\t64421\t-1
mezuzah\t52457\t-1
modern mezuzah\t15123\t-1
jewish mezuzah\t15124\t-1
baby mezuzah\t15899\t-1
hamsa mezuzah\t19809\t-1
glass mezuzah\t16479\t-1
custom mezuzah\t13681\t-1
hanukkah favors\t0\t4090`;

fs.appendFileSync(file, '\n' + more);
const total = fs.readFileSync(file, 'utf8').split('\n').filter(l => l.trim()).length;
console.log('Total lines in file: ' + total);
