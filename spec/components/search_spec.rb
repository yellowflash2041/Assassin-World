# encoding: utf-8

require 'spec_helper'
require_dependency 'search'

describe Search do

  class TextHelper
    extend ActionView::Helpers::TextHelper
  end

  before do
    ActiveRecord::Base.observers.enable :search_observer
  end

  def first_of_type(results, type)
    return nil if results.blank?
    results.each do |r|
      return r[:results].first if r[:type] == type
    end
    nil
  end

  def result_ids_for_type(results, type)
    results.find do |group|
      group[:type] == type
    end[:results].map {|r| r[:id]}
  end

  context 'post indexing observer' do
    before do
      @category = Fabricate(:category, name: 'america')
      @topic = Fabricate(:topic, title: 'sam saffron test topic', category: @category)
      @post = Fabricate(:post, topic: @topic, raw: 'this <b>fun test</b> <img src="bla" title="my image">')
      @indexed = @post.post_search_data.search_data
    end
    it "should include body in index" do
      @indexed.should =~ /fun/
    end
    it "should include title in index" do
      @indexed.should =~ /sam/
    end
    it "should include category in index" do
      @indexed.should =~ /america/
    end

    it "should pick up on title updates" do
      @topic.title = "harpi is the new title"
      @topic.save!
      @post.post_search_data.reload

      @indexed = @post.post_search_data.search_data

      @indexed.should =~ /harpi/
    end
  end

  context 'user indexing observer' do
    before do
      @user = Fabricate(:user, username: 'fred', name: 'bob jones')
      @indexed = @user.user_search_data.search_data
    end

    it "should pick up on username" do
      @indexed.should =~ /fred/
    end

    it "should pick up on name" do
      @indexed.should =~ /jone/
    end
  end

  context 'category indexing observer' do
    before do
      @category = Fabricate(:category, name: 'america')
      @indexed = @category.category_search_data.search_data
    end

    it "should pick up on name" do
      @indexed.should =~ /america/
    end

  end

  it 'returns something blank on a nil search' do
    ActiveRecord::Base.expects(:exec_sql).never
    Search.new(nil).execute.should be_blank
  end

  it 'does not search when the search term is too small' do
    ActiveRecord::Base.expects(:exec_sql).never
    Search.new('evil', min_search_term_length: 5).execute.should be_blank
  end

  it 'escapes non alphanumeric characters' do
    Search.new('foo :!$);}]>@\#\"\'').execute.should be_blank # There are at least three levels of sanitation for Search.query!
  end

  it "doesn't raise an error when single quotes are present" do
    Search.new("'hello' world").execute.should be_blank # There are at least three levels of sanitation for Search.query!
  end

  it 'works when given two terms with spaces' do
    lambda { Search.new('evil trout').execute }.should_not raise_error
  end

  context 'users' do
    let!(:user) { Fabricate(:user) }
    let(:result) { first_of_type( Search.new('bruce', type_filter: 'user').execute, 'user') }

    it 'returns a result' do
      result.should be_present
      result[:title].should == user.username
      result[:avatar_template].should_not be_nil
      result[:url].should == "/users/#{user.username_lower}"
    end

  end

  context 'topics' do
    let(:topic) { Fabricate(:topic) }


    context 'search within topic' do

      def new_post(raw, topic)
        Fabricate(:post, topic: topic, topic_id: topic.id, user: topic.user, raw: raw)
      end

      it 'displays multiple results within a topic' do

        topic = Fabricate(:topic)
        topic2 = Fabricate(:topic)

        new_post('this is the other post I am posting', topic2)
        new_post('this is my fifth post I am posting', topic2)

        post1 = new_post('this is the other post I am posting', topic)
        post2 = new_post('this is my first post I am posting', topic)
        post3 = new_post('this is a real long and complicated bla this is my second post I am Posting birds
                         with more stuff bla bla', topic)
        post4 = new_post('this is my fourth post I am posting', topic)

        # update posts_count
        topic.reload

        results = Search.new('posting', search_context: post1.topic).execute.find do |r|
          r[:type] == "topic"
        end[:results]

        results.find{|r| r[:title].include? 'birds'}.should_not be_nil

        results.map{|r| r[:id]}.should == [
          post1.topic_id,
          "_#{post2.id}",
          "_#{post3.id}",
          "_#{post4.id}"]

        # stop words should work
        results = Search.new('this', search_context: post1.topic).execute.find do |r|
          r[:type] == "topic"
        end[:results]

        results.length.should == 4

      end
    end

    context 'searching the OP' do
      let!(:post) { Fabricate(:post_with_long_raw_content, topic: topic, user: topic.user) }
      let(:result) { first_of_type(Search.new('hundred', type_filter: 'topic', include_blurbs: true).execute, 'topic') }

      it 'returns a result correctly' do
        result.should be_present
        result[:title].should == topic.title
        result[:url].should == topic.relative_url
        result[:blurb].should == TextHelper.excerpt(post.raw, 'hundred', radius: 100)
      end
    end

    context 'searching for a post' do
      let!(:post) { Fabricate(:post, topic: topic, user: topic.user) }
      let!(:reply) { Fabricate(:basic_reply, topic: topic, user: topic.user) }
      let(:result) { first_of_type(Search.new('quote', type_filter: 'topic').execute, 'topic') }

      it 'returns the post' do
        result.should be_present
        result[:title].should == topic.title

        result[:url].should == topic.relative_url + "/2"
      end
    end

    context "search for a topic by id" do
      let(:result) { first_of_type(Search.new(topic.id, type_filter: 'topic', search_for_id: true, min_search_term_length: 1).execute, 'topic') }

      it 'returns the topic' do
        result.should be_present
        result[:title].should == topic.title
        result[:url].should == topic.relative_url
      end
    end

    context "search for a topic by url" do
      let(:result) { first_of_type(Search.new(topic.relative_url, search_for_id: true, type_filter: 'topic').execute, 'topic') }

      it 'returns the topic' do
        result.should be_present
        result[:title].should == topic.title
        result[:url].should == topic.relative_url
      end
    end

    context 'security' do
      let!(:post) { Fabricate(:post, topic: topic, user: topic.user) }

      def result(current_user)
        first_of_type(Search.new('hello', guardian: current_user).execute, 'topic')
      end

      it 'secures results correctly' do
        category = Fabricate(:category)

        topic.category_id = category.id
        topic.save

        category.set_permissions(:staff => :full)
        category.save

        result(nil).should_not be_present
        result(Fabricate(:user)).should_not be_present
        result(Fabricate(:admin)).should be_present

      end
    end

  end

  context 'cyrillic topic' do
    let!(:cyrillic_topic) { Fabricate(:topic) do
                                                user
                                                title { sequence(:title) { |i| "Тестовая запись #{i}" } }
                                              end
    }
    let!(:post) {Fabricate(:post, topic: cyrillic_topic, user: cyrillic_topic.user)}
    let(:result) { first_of_type(Search.new('запись').execute, 'topic') }

    it 'finds something when given cyrillic query' do
      result.should be_present
    end
  end

  context 'categories' do

    let!(:category) { Fabricate(:category) }
    def result
      first_of_type(Search.new('amazing').execute, 'category')
    end

    it 'returns the correct result' do
      r = result
      r.should be_present
      r[:title].should == category.name
      r[:url].should == "/category/#{category.slug}"

      category.set_permissions({})
      category.save

      result.should_not be_present
    end

  end


  context 'type_filter' do

    let!(:user) { Fabricate(:user, username: 'amazing', email: 'amazing@amazing.com') }
    let!(:category) { Fabricate(:category, name: 'amazing category', user: user) }


    context 'user filter' do
      let(:results) { Search.new('amazing', type_filter: 'user').execute }

      it "returns a user result" do
        results.detect {|r| r[:type] == 'user'}.should be_present
        results.detect {|r| r[:type] == 'category'}.should be_blank
      end

    end

    context 'category filter' do
      let(:results) { Search.new('amazing', type_filter: 'category').execute }

      it "returns a category result" do
        results.detect {|r| r[:type] == 'user'}.should be_blank
        results.detect {|r| r[:type] == 'category'}.should be_present
      end

    end

  end

  context 'search_context' do

    context 'user as a search context' do
      let(:coding_horror) { Fabricate(:coding_horror) }

      Given!(:post) { Fabricate(:post) }
      Given!(:coding_horror_post) { Fabricate(:post, user: coding_horror )}
      When(:search_user) { Search.new('hello', search_context: post.user).execute }

      # should find topic created by searched user first
      Then          { first_of_type(search_user, 'topic')[:id].should == post.topic_id }
    end

    context 'category as a search context' do
      let(:category) { Fabricate(:category) }
      let(:topic) { Fabricate(:topic, category: category) }
      let(:topic_no_cat) { Fabricate(:topic) }

      Given!(:post) { Fabricate(:post, topic: topic, user: topic.user ) }
      Given!(:another_post) { Fabricate(:post, topic: topic_no_cat, user: topic.user ) }
      When(:search_cat) { Search.new('hello', search_context: category).execute }
      # should find topic in searched category first
      Then          { first_of_type(search_cat, 'topic')[:id].should == topic.id }
    end

  end

  describe 'Chinese search' do
    it 'splits English / Chinese' do
      SiteSetting.default_locale = 'zh_CN'
      data = Search.prepare_data('Discourse社区指南').split(' ')
      data.should == ['Discourse', '社区','指南']
    end

    it 'finds chinese topic based on title' do
      SiteSetting.default_locale = 'zh_TW'
      topic = Fabricate(:topic, title: 'My Title Discourse社区指南')
      Fabricate(:post, topic: topic)

      Search.new('社区指南').execute[0][:results][0][:id].should == topic.id
      Search.new('指南').execute[0][:results][0][:id].should == topic.id
    end
  end

end

