#
# Cookbook Name:: vim
# Recipe:: default
#
# Copyright 2010, Opscode, Inc.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#

# There is no vim package on RHEL/CentOS derivatives
# * vim-minimal gives you /bin/vi
# * vim-enhanced gives you /usr/bin/vim
vim_base_pkgs = value_for_platform(
  ["ubuntu", "debian", "arch"] => { "default" => ["vim"] },
  ["redhat", "centos", "fedora", "scientific"] => { "default" => ["vim-minimal","vim-enhanced"] },
  "default" => ["vim"]
)

vim_base_pkgs.each do |vim_base_pkg|
  package vim_base_pkg
end

node[:vim][:extra_packages].each do |vimpkg|
  package vimpkg
end
