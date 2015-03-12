ace.define("ace/snippets/django",["require","exports","module"],function(e,t,n){"use strict";t.snippetText="# Model Fields\n\n# Note: Optional arguments are using defaults that match what Django will use\n# as a default, e.g. with max_length fields.  Doing this as a form of self\n# documentation and to make it easy to know whether you should override the\n# default or not.\n\n# Note: Optional arguments that are booleans will use the opposite since you\n# can either not specify them, or override them, e.g. auto_now_add=False.\n\nsnippet auto\n	${1:FIELDNAME} = models.AutoField(${2})\nsnippet bool\n	${1:FIELDNAME} = models.BooleanField(${2:default=True})\nsnippet char\n	${1:FIELDNAME} = models.CharField(max_length=${2}${3:, blank=True})\nsnippet comma\n	${1:FIELDNAME} = models.CommaSeparatedIntegerField(max_length=${2}${3:, blank=True})\nsnippet date\n	${1:FIELDNAME} = models.DateField(${2:auto_now_add=True, auto_now=True}${3:, blank=True, null=True})\nsnippet datetime\n	${1:FIELDNAME} = models.DateTimeField(${2:auto_now_add=True, auto_now=True}${3:, blank=True, null=True})\nsnippet decimal\n	${1:FIELDNAME} = models.DecimalField(max_digits=${2}, decimal_places=${3})\nsnippet email\n	${1:FIELDNAME} = models.EmailField(max_length=${2:75}${3:, blank=True})\nsnippet file\n	${1:FIELDNAME} = models.FileField(upload_to=${2:path/for/upload}${3:, max_length=100})\nsnippet filepath\n	${1:FIELDNAME} = models.FilePathField(path=${2:\"/abs/path/to/dir\"}${3:, max_length=100}${4:, match=\"*.ext\"}${5:, recursive=True}${6:, blank=True, })\nsnippet float\n	${1:FIELDNAME} = models.FloatField(${2})\nsnippet image\n	${1:FIELDNAME} = models.ImageField(upload_to=${2:path/for/upload}${3:, height_field=height, width_field=width}${4:, max_length=100})\nsnippet int\n	${1:FIELDNAME} = models.IntegerField(${2})\nsnippet ip\n	${1:FIELDNAME} = models.IPAddressField(${2})\nsnippet nullbool\n	${1:FIELDNAME} = models.NullBooleanField(${2})\nsnippet posint\n	${1:FIELDNAME} = models.PositiveIntegerField(${2})\nsnippet possmallint\n	${1:FIELDNAME} = models.PositiveSmallIntegerField(${2})\nsnippet slug\n	${1:FIELDNAME} = models.SlugField(max_length=${2:50}${3:, blank=True})\nsnippet smallint\n	${1:FIELDNAME} = models.SmallIntegerField(${2})\nsnippet text\n	${1:FIELDNAME} = models.TextField(${2:blank=True})\nsnippet time\n	${1:FIELDNAME} = models.TimeField(${2:auto_now_add=True, auto_now=True}${3:, blank=True, null=True})\nsnippet url\n	${1:FIELDNAME} = models.URLField(${2:verify_exists=False}${3:, max_length=200}${4:, blank=True})\nsnippet xml\n	${1:FIELDNAME} = models.XMLField(schema_path=${2:None}${3:, blank=True})\n# Relational Fields\nsnippet fk\n	${1:FIELDNAME} = models.ForeignKey(${2:OtherModel}${3:, related_name=''}${4:, limit_choices_to=}${5:, to_field=''})\nsnippet m2m\n	${1:FIELDNAME} = models.ManyToManyField(${2:OtherModel}${3:, related_name=''}${4:, limit_choices_to=}${5:, symmetrical=False}${6:, through=''}${7:, db_table=''})\nsnippet o2o\n	${1:FIELDNAME} = models.OneToOneField(${2:OtherModel}${3:, parent_link=True}${4:, related_name=''}${5:, limit_choices_to=}${6:, to_field=''})\n\n# Code Skeletons\n\nsnippet form\n	class ${1:FormName}(forms.Form):\n		\"\"\"${2:docstring}\"\"\"\n		${3}\n\nsnippet model\n	class ${1:ModelName}(models.Model):\n		\"\"\"${2:docstring}\"\"\"\n		${3}\n		\n		class Meta:\n			${4}\n		\n		def __unicode__(self):\n			${5}\n		\n		def save(self, force_insert=False, force_update=False):\n			${6}\n		\n		@models.permalink\n		def get_absolute_url(self):\n			return ('${7:view_or_url_name}' ${8})\n\nsnippet modeladmin\n	class ${1:ModelName}Admin(admin.ModelAdmin):\n		${2}\n	\n	admin.site.register($1, $1Admin)\n	\nsnippet tabularinline\n	class ${1:ModelName}Inline(admin.TabularInline):\n		model = $1\n\nsnippet stackedinline\n	class ${1:ModelName}Inline(admin.StackedInline):\n		model = $1\n\nsnippet r2r\n	return render_to_response('${1:template.html}', {\n			${2}\n		}${3:, context_instance=RequestContext(request)}\n	)\n",t.scope="django"})