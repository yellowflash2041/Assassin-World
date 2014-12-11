desc "update emoji images"
task "emoji:update" => :environment do
  download_emojis_for("emoji_one", "https://raw.githubusercontent.com/Ranks/emojione/master/assets/png/%s.png", uppercase: true, leading_zeros: true)
  download_emojis_for("twitter", "https://raw.githubusercontent.com/twitter/twemoji/gh-pages/72x72/%s.png", lowercase: true)
  download_emojis_for("apple", "https://raw.githubusercontent.com/github/gemoji/master/images/emoji/unicode/%s.png", lowercase: true, leading_zeros: true)
  # download_google_emojis("https://raw.githubusercontent.com/gjtorikian/NotoColorEmoji-png/master/images/68x64/%s.png")
end

def download_emojis_for(set, url_template, options={})
  puts "Downloading emojis for #{set}..."

  uppercase = options[:uppercase] == true
  lowercase = options[:lowercase] == true
  leading_zeros = options[:leading_zeros] == true

  Emoji.all.each do |emoji|
    codepoints = emoji["emoji"].codepoints.map { |c| c.to_s(16).rjust(leading_zeros ? 4 : 0, '0') }
    filename = codepoints.join('-').sub(/-fe0f\b/, '')
    filename = filename.downcase if lowercase
    filename = filename.upcase if uppercase
    puts "#{filename} -> #{emoji["emoji"]}"
    url = url_template % filename
    data = open(url).read rescue nil
    next if data.nil?
    emoji["aliases"].each do |name|
      File.open("plugins/emoji/public/images/#{set}/#{name}.png", "wb") { |f| f << data }
    end
  end
end

# extracted from the NotoColorEmoji font
GOOGLE_EMOJIS = {169=>19, 174=>20, 8419=>23, 8482=>25, 8986=>114, 8987=>115, 9193=>806, 9194=>807, 9195=>270, 9196=>271, 9200=>275, 9203=>276, 9729=>86, 9745=>799, 9748=>654, 9749=>655, 9757=>17, 9786=>692, 9800=>702, 9801=>622, 9802=>704, 9803=>705, 9804=>706, 9805=>626, 9806=>708, 9807=>709, 9808=>710, 9809=>711, 9810=>712, 9811=>713, 9851=>714, 9855=>715, 9875=>805, 9888=>816, 9889=>749, 9917=>14, 9918=>15, 9924=>784, 9925=>785, 9934=>786, 9940=>787, 9962=>788, 9970=>789, 9971=>790, 9973=>791, 9978=>792, 9981=>793, 9989=>794, 9994=>795, 9995=>796, 9996=>797, 10024=>798, 10060=>800, 10062=>801, 10067=>802, 10068=>803, 10069=>804, 10133=>810, 10134=>811, 10135=>812, 10160=>814, 10175=>815, 12336=>24, 126980=>1, 127183=>21, 127344=>26, 127345=>27, 127358=>28, 127359=>29, 127374=>30, 127377=>31, 127378=>32, 127379=>33, 127380=>34, 127381=>35, 127382=>36, 127383=>37, 127384=>38, 127385=>39, 127386=>40, 127462=>41, 127463=>42, 127464=>43, 127465=>44, 127466=>45, 127467=>46, 127468=>47, 127469=>48, 127470=>49, 127471=>50, 127472=>51, 127473=>52, 127474=>53, 127475=>54, 127476=>55, 127477=>56, 127478=>57, 127479=>58, 127480=>59, 127481=>60, 127482=>61, 127483=>62, 127484=>63, 127485=>64, 127486=>65, 127487=>66, 127489=>67, 127490=>68, 127514=>69, 127535=>71, 127538=>72, 127539=>73, 127540=>74, 127541=>75, 127542=>76, 127543=>77, 127544=>78, 127545=>79, 127546=>80, 127568=>81, 127569=>82, 127744=>88, 127745=>89, 127746=>90, 127747=>91, 127748=>92, 127749=>93, 127750=>94, 127751=>95, 127752=>96, 127753=>97, 127754=>98, 127755=>99, 127756=>100, 127757=>101, 127758=>102, 127759=>103, 127760=>104, 127761=>105, 127762=>106, 127763=>107, 127764=>108, 127765=>109, 127766=>110, 127767=>111, 127768=>112, 127769=>113, 127770=>84, 127771=>85, 127772=>116, 127773=>117, 127774=>118, 127775=>119, 127776=>120, 127792=>121, 127793=>122, 127794=>123, 127795=>124, 127796=>125, 127797=>126, 127799=>127, 127800=>128, 127801=>129, 127802=>130, 127803=>131, 127804=>132, 127805=>133, 127806=>134, 127807=>135, 127808=>136, 127809=>137, 127810=>138, 127811=>139, 127812=>140, 127813=>141, 127814=>142, 127815=>143, 127816=>144, 127817=>145, 127818=>146, 127819=>147, 127820=>148, 127821=>149, 127822=>150, 127823=>151, 127824=>152, 127825=>153, 127826=>154, 127827=>155, 127828=>156, 127829=>157, 127830=>158, 127831=>159, 127832=>160, 127833=>161, 127834=>162, 127835=>163, 127836=>164, 127837=>165, 127838=>166, 127839=>167, 127840=>168, 127841=>169, 127842=>170, 127843=>171, 127844=>172, 127845=>173, 127846=>174, 127847=>175, 127848=>176, 127849=>177, 127850=>178, 127851=>179, 127852=>180, 127853=>181, 127854=>182, 127855=>183, 127856=>184, 127857=>185, 127858=>186, 127859=>187, 127860=>188, 127861=>189, 127862=>190, 127863=>191, 127864=>192, 127865=>193, 127866=>194, 127867=>195, 127868=>196, 127872=>197, 127873=>198, 127874=>199, 127875=>200, 127876=>201, 127877=>202, 127878=>203, 127879=>204, 127880=>205, 127881=>206, 127882=>207, 127883=>208, 127884=>209, 127885=>210, 127886=>211, 127887=>212, 127888=>213, 127889=>214, 127890=>215, 127891=>216, 127904=>217, 127905=>218, 127906=>219, 127907=>220, 127908=>221, 127909=>222, 127910=>223, 127911=>224, 127912=>225, 127913=>226, 127914=>227, 127915=>228, 127916=>229, 127917=>230, 127918=>231, 127919=>232, 127920=>233, 127921=>234, 127922=>235, 127923=>236, 127924=>237, 127925=>238, 127926=>239, 127927=>240, 127928=>241, 127929=>242, 127930=>243, 127931=>244, 127932=>245, 127933=>246, 127934=>247, 127935=>248, 127936=>249, 127937=>250, 127938=>251, 127939=>252, 127940=>253, 127942=>254, 127943=>255, 127944=>256, 127945=>257, 127946=>258, 127968=>259, 127969=>260, 127970=>261, 127971=>262, 127972=>263, 127973=>264, 127974=>265, 127975=>266, 127976=>267, 127977=>268, 127978=>269, 127979=>808, 127980=>809, 127981=>272, 127982=>273, 127983=>274, 127984=>813, 128000=>277, 128001=>278, 128002=>279, 128003=>280, 128004=>281, 128005=>282, 128006=>283, 128007=>284, 128008=>285, 128009=>286, 128010=>287, 128011=>288, 128012=>289, 128013=>290, 128014=>291, 128015=>292, 128016=>293, 128017=>294, 128018=>295, 128019=>296, 128020=>297, 128021=>298, 128022=>299, 128023=>300, 128024=>301, 128025=>302, 128026=>303, 128027=>304, 128028=>305, 128029=>306, 128030=>307, 128031=>308, 128032=>309, 128033=>310, 128034=>311, 128035=>312, 128036=>313, 128037=>314, 128038=>315, 128039=>316, 128040=>317, 128041=>318, 128042=>319, 128043=>320, 128044=>321, 128045=>322, 128046=>323, 128047=>324, 128048=>325, 128049=>326, 128050=>327, 128051=>328, 128052=>329, 128053=>330, 128054=>331, 128055=>332, 128056=>333, 128057=>334, 128058=>335, 128059=>336, 128060=>337, 128061=>338, 128062=>339, 128064=>340, 128066=>341, 128067=>342, 128068=>343, 128069=>344, 128070=>345, 128071=>346, 128072=>347, 128073=>348, 128074=>349, 128075=>350, 128076=>351, 128077=>352, 128078=>353, 128079=>354, 128080=>355, 128081=>356, 128082=>357, 128083=>358, 128084=>359, 128085=>360, 128086=>361, 128087=>362, 128088=>363, 128089=>364, 128090=>365, 128091=>366, 128092=>367, 128093=>368, 128094=>369, 128095=>370, 128096=>371, 128097=>372, 128098=>373, 128099=>374, 128100=>375, 128101=>376, 128102=>377, 128103=>378, 128104=>379, 128105=>380, 128106=>381, 128107=>382, 128108=>383, 128109=>384, 128110=>385, 128111=>386, 128112=>387, 128113=>388, 128114=>389, 128115=>390, 128116=>391, 128117=>392, 128118=>393, 128119=>394, 128120=>395, 128121=>87, 128122=>397, 128123=>398, 128124=>399, 128125=>400, 128126=>401, 128127=>402, 128128=>403, 128129=>404, 128130=>405, 128131=>406, 128132=>407, 128133=>408, 128134=>409, 128135=>410, 128136=>411, 128137=>412, 128138=>413, 128139=>414, 128140=>415, 128141=>416, 128142=>417, 128143=>418, 128144=>419, 128145=>420, 128146=>421, 128147=>422, 128148=>423, 128149=>424, 128150=>425, 128151=>426, 128152=>427, 128153=>428, 128154=>429, 128155=>430, 128156=>431, 128157=>432, 128158=>433, 128159=>434, 128160=>435, 128161=>436, 128162=>437, 128163=>438, 128164=>439, 128165=>440, 128166=>441, 128167=>442, 128168=>443, 128169=>444, 128170=>445, 128171=>446, 128172=>447, 128173=>448, 128174=>449, 128175=>450, 128176=>451, 128177=>452, 128178=>453, 128179=>454, 128180=>455, 128181=>456, 128182=>457, 128183=>458, 128184=>459, 128185=>460, 128186=>461, 128187=>462, 128188=>463, 128189=>464, 128190=>465, 128191=>466, 128192=>467, 128193=>468, 128194=>469, 128195=>470, 128196=>471, 128197=>472, 128198=>473, 128199=>474, 128200=>475, 128201=>476, 128202=>477, 128203=>478, 128204=>479, 128205=>480, 128206=>481, 128207=>482, 128208=>483, 128209=>484, 128210=>485, 128211=>486, 128212=>487, 128213=>488, 128214=>489, 128215=>490, 128216=>491, 128217=>492, 128218=>493, 128219=>494, 128220=>495, 128221=>496, 128222=>497, 128223=>498, 128224=>499, 128225=>500, 128226=>501, 128227=>502, 128228=>503, 128229=>604, 128230=>505, 128231=>613, 128232=>507, 128233=>615, 128234=>616, 128235=>510, 128236=>511, 128237=>512, 128238=>620, 128239=>514, 128240=>515, 128241=>516, 128242=>517, 128243=>518, 128244=>519, 128245=>520, 128246=>521, 128247=>522, 128249=>523, 128250=>524, 128251=>525, 128252=>526, 128256=>527, 128257=>528, 128258=>529, 128259=>530, 128260=>531, 128261=>532, 128262=>533, 128263=>534, 128264=>535, 128265=>536, 128266=>537, 128267=>538, 128268=>539, 128269=>540, 128270=>541, 128271=>542, 128272=>543, 128273=>544, 128274=>545, 128275=>546, 128276=>547, 128277=>548, 128278=>549, 128279=>550, 128280=>551, 128281=>552, 128282=>553, 128283=>554, 128284=>555, 128285=>556, 128286=>557, 128287=>558, 128288=>559, 128289=>560, 128290=>561, 128291=>562, 128292=>563, 128293=>564, 128294=>565, 128295=>566, 128296=>567, 128297=>568, 128298=>569, 128299=>570, 128300=>571, 128301=>572, 128302=>573, 128303=>574, 128304=>575, 128305=>576, 128306=>577, 128307=>578, 128308=>579, 128309=>580, 128310=>581, 128311=>582, 128312=>583, 128313=>584, 128314=>585, 128315=>586, 128316=>587, 128317=>588, 128336=>589, 128337=>590, 128338=>591, 128339=>592, 128340=>593, 128341=>594, 128342=>595, 128343=>596, 128344=>597, 128345=>598, 128346=>599, 128347=>600, 128348=>601, 128349=>602, 128350=>603, 128351=>13, 128352=>605, 128353=>606, 128354=>607, 128355=>608, 128356=>609, 128357=>610, 128358=>611, 128359=>612, 128507=>629, 128508=>630, 128509=>631, 128510=>632, 128511=>633, 128512=>634, 128513=>635, 128514=>636, 128515=>637, 128516=>638, 128517=>639, 128518=>640, 128519=>641, 128520=>642, 128521=>643, 128522=>644, 128523=>645, 128524=>646, 128525=>647, 128526=>648, 128527=>649, 128528=>650, 128529=>651, 128530=>652, 128531=>653, 128532=>396, 128533=>678, 128534=>656, 128535=>657, 128536=>658, 128537=>659, 128538=>660, 128539=>661, 128540=>662, 128541=>663, 128542=>664, 128543=>665, 128544=>666, 128545=>667, 128546=>668, 128547=>669, 128548=>670, 128549=>671, 128550=>672, 128551=>673, 128552=>674, 128553=>675, 128554=>676, 128555=>677, 128556=>22, 128557=>679, 128558=>680, 128559=>681, 128560=>682, 128561=>683, 128562=>684, 128563=>685, 128564=>686, 128565=>687, 128566=>688, 128567=>689, 128568=>690, 128569=>691, 128570=>83, 128571=>693, 128572=>694, 128573=>695, 128574=>696, 128575=>697, 128576=>698, 128581=>699, 128582=>700, 128583=>701, 128584=>621, 128585=>703, 128586=>623, 128587=>624, 128588=>625, 128589=>707, 128590=>627, 128591=>628, 128640=>716, 128641=>717, 128642=>718, 128643=>719, 128644=>720, 128645=>721, 128646=>722, 128647=>723, 128648=>724, 128649=>725, 128650=>726, 128651=>727, 128652=>728, 128653=>729, 128654=>730, 128655=>731, 128656=>732, 128657=>733, 128658=>734, 128659=>735, 128660=>736, 128661=>737, 128662=>738, 128663=>739, 128664=>740, 128665=>741, 128666=>742, 128667=>743, 128668=>744, 128669=>745, 128670=>746, 128671=>747, 128672=>748, 128673=>817, 128674=>750, 128675=>751, 128676=>752, 128677=>753, 128678=>754, 128679=>755, 128680=>756, 128681=>757, 128682=>758, 128683=>759, 128684=>760, 128685=>761, 128686=>762, 128687=>763, 128688=>764, 128689=>765, 128690=>766, 128691=>767, 128692=>768, 128693=>769, 128694=>770, 128695=>771, 128696=>772, 128697=>773, 128698=>774, 128699=>775, 128700=>776, 128701=>777, 128702=>778, 128703=>779, 128704=>780, 128705=>781, 128706=>782, 128707=>783, 128708=>16, 128709=>18, 1041637=>504, 1041638=>70, 1041639=>506, 1041640=>614, 1041641=>508, 1041642=>509, 1041643=>617, 1041644=>618, 1041645=>619, 1041646=>513, 1042476=>2, 1042478=>3, 1042479=>4, 1042480=>5, 1042481=>6, 1042482=>7, 1042483=>8, 1042484=>9, 1042485=>10, 1042486=>11, 1042487=>12}.freeze

def download_google_emojis(url_template)
  puts "Downloading emojis for google..."
  Emoji.all.each do |emoji|
    codepoint = emoji["emoji"].codepoints.first
    filename = GOOGLE_EMOJIS[codepoint]
    next if filename.nil?
    puts "#{filename} -> #{emoji["emoji"]}"
    url = url_template % filename
    data = open(url).read rescue nil
    next if data.nil?
    emoji["aliases"].each do |name|
      File.open("plugins/emoji/public/images/google/#{name}.png", "wb") { |f| f << data }
    end
  end
end
