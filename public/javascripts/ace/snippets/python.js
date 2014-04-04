ace.define("ace/snippets/python",["require","exports","module"],function(e,t,n){t.snippetText='snippet #!\n	#!/usr/bin/env python\nsnippet imp\n	import ${1:module}\nsnippet from\n	from ${1:package} import ${2:module}\n# Module Docstring\nsnippet docs\n	\'\'\'\n	File: ${1:FILENAME:file_name}\n	Author: ${2:author}\n	Description: ${3}\n	\'\'\'\nsnippet wh\n	while ${1:condition}:\n		${2:# TODO: write code...}\n# dowh - does the same as do...while in other languages\nsnippet dowh\n	while True:\n		${1:# TODO: write code...}\n		if ${2:condition}:\n			break\nsnippet with\n	with ${1:expr} as ${2:var}:\n		${3:# TODO: write code...}\n# New Class\nsnippet cl\n	class ${1:ClassName}(${2:object}):\n		"""${3:docstring for $1}"""\n		def __init__(self, ${4:arg}):\n			${5:super($1, self).__init__()}\n			self.$4 = $4\n			${6}\n# New Function\nsnippet def\n	def ${1:fname}(${2:`indent(\'.\') ? \'self\' : \'\'`}):\n		"""${3:docstring for $1}"""\n		${4:# TODO: write code...}\nsnippet deff\n	def ${1:fname}(${2:`indent(\'.\') ? \'self\' : \'\'`}):\n		${3:# TODO: write code...}\n# New Method\nsnippet defs\n	def ${1:mname}(self, ${2:arg}):\n		${3:# TODO: write code...}\n# New Property\nsnippet property\n	def ${1:foo}():\n		doc = "${2:The $1 property.}"\n		def fget(self):\n			${3:return self._$1}\n		def fset(self, value):\n			${4:self._$1 = value}\n# Ifs\nsnippet if\n	if ${1:condition}:\n		${2:# TODO: write code...}\nsnippet el\n	else:\n		${1:# TODO: write code...}\nsnippet ei\n	elif ${1:condition}:\n		${2:# TODO: write code...}\n# For\nsnippet for\n	for ${1:item} in ${2:items}:\n		${3:# TODO: write code...}\n# Encodes\nsnippet cutf8\n	# -*- coding: utf-8 -*-\nsnippet clatin1\n	# -*- coding: latin-1 -*-\nsnippet cascii\n	# -*- coding: ascii -*-\n# Lambda\nsnippet ld\n	${1:var} = lambda ${2:vars} : ${3:action}\nsnippet .\n	self.\nsnippet try Try/Except\n	try:\n		${1:# TODO: write code...}\n	except ${2:Exception}, ${3:e}:\n		${4:raise $3}\nsnippet try Try/Except/Else\n	try:\n		${1:# TODO: write code...}\n	except ${2:Exception}, ${3:e}:\n		${4:raise $3}\n	else:\n		${5:# TODO: write code...}\nsnippet try Try/Except/Finally\n	try:\n		${1:# TODO: write code...}\n	except ${2:Exception}, ${3:e}:\n		${4:raise $3}\n	finally:\n		${5:# TODO: write code...}\nsnippet try Try/Except/Else/Finally\n	try:\n		${1:# TODO: write code...}\n	except ${2:Exception}, ${3:e}:\n		${4:raise $3}\n	else:\n		${5:# TODO: write code...}\n	finally:\n		${6:# TODO: write code...}\n# if __name__ == \'__main__\':\nsnippet ifmain\n	if __name__ == \'__main__\':\n		${1:main()}\n# __magic__\nsnippet _\n	__${1:init}__${2}\n# python debugger (pdb)\nsnippet pdb\n	import pdb; pdb.set_trace()\n# ipython debugger (ipdb)\nsnippet ipdb\n	import ipdb; ipdb.set_trace()\n# ipython debugger (pdbbb)\nsnippet pdbbb\n	import pdbpp; pdbpp.set_trace()\nsnippet pprint\n	import pprint; pprint.pprint(${1})${2}\nsnippet "\n	"""\n	${1:doc}\n	"""\n# test function/method\nsnippet test\n	def test_${1:description}(${2:self}):\n		${3:# TODO: write code...}\n# test case\nsnippet testcase\n	class ${1:ExampleCase}(unittest.TestCase):\n		\n		def test_${2:description}(self):\n			${3:# TODO: write code...}\nsnippet fut\n	from __future__ import ${1}\n#getopt\nsnippet getopt\n	try:\n		# Short option syntax: "hv:"\n		# Long option syntax: "help" or "verbose="\n		opts, args = getopt.getopt(sys.argv[1:], "${1:short_options}", [${2:long_options}])\n	\n	except getopt.GetoptError, err:\n		# Print debug info\n		print str(err)\n		${3:error_action}\n\n	for option, argument in opts:\n		if option in ("-h", "--help"):\n			${4}\n		elif option in ("-v", "--verbose"):\n			verbose = argument\n',t.scope="python"})