require 'rails_helper'
require 'email/sender'

describe Email::Sender do

  it "doesn't deliver mail when mails are disabled" do
    SiteSetting.disable_emails = true
    Mail::Message.any_instance.expects(:deliver_now).never
    message = Mail::Message.new(to: "hello@world.com" , body: "hello")
    expect(Email::Sender.new(message, :hello).send).to eq(nil)
  end

  it "delivers mail when mails are disabled but the email_type is admin_login" do
    SiteSetting.disable_emails = true
    Mail::Message.any_instance.expects(:deliver_now).once
    message = Mail::Message.new(to: "hello@world.com" , body: "hello")
    Email::Sender.new(message, :admin_login).send
  end

  it "doesn't deliver mail when the message is of type NullMail" do
    Mail::Message.any_instance.expects(:deliver_now).never
    message = ActionMailer::Base::NullMail.new
    expect(Email::Sender.new(message, :hello).send).to eq(nil)
  end

  it "doesn't deliver mail when the message is nil" do
    Mail::Message.any_instance.expects(:deliver_now).never
    Email::Sender.new(nil, :hello).send
  end

  it "doesn't deliver when the to address is nil" do
    message = Mail::Message.new(body: 'hello')
    message.expects(:deliver_now).never
    Email::Sender.new(message, :hello).send
  end

  it "doesn't deliver when the body is nil" do
    message = Mail::Message.new(to: 'eviltrout@test.domain')
    message.expects(:deliver_now).never
    Email::Sender.new(message, :hello).send
  end

  context "host_for" do
    it "defaults to localhost" do
      expect(Email::Sender.host_for(nil)).to eq("localhost")
    end

    it "returns localhost for a weird host" do
      expect(Email::Sender.host_for("this is not a real host")).to eq("localhost")
    end

    it "parses hosts from urls" do
      expect(Email::Sender.host_for("http://meta.discourse.org")).to eq("meta.discourse.org")
    end

    it "downcases hosts" do
      expect(Email::Sender.host_for("http://ForumSite.com")).to eq("forumsite.com")
    end

  end

  context 'with a valid message' do

    let(:reply_key) { "abcd" * 8 }

    let(:message) do
      message = Mail::Message.new to: 'eviltrout@test.domain',
                                  body: '**hello**'
      message.stubs(:deliver_now)
      message
    end

    let(:email_sender) { Email::Sender.new(message, :valid_type) }

    it 'calls deliver' do
      message.expects(:deliver_now).once
      email_sender.send
    end

    context "doesn't add return_path when no plus addressing" do
      before { SiteSetting.reply_by_email_address = '%{reply_key}@test.com' }

      it 'should not set the return_path' do
        email_sender.send
        expect(message.header[:return_path].to_s).to eq("")
      end
    end

    context "adds return_path with plus addressing" do
      before { SiteSetting.reply_by_email_address = 'replies+%{reply_key}@test.com' }

      it 'should set the return_path' do
        email_sender.send
        expect(message.header[:return_path].to_s).to eq("replies+verp-#{EmailLog.last.bounce_key}@test.com")
      end
    end

    context "adds a List-ID header to identify the forum" do
      before do
        category =  Fabricate(:category, name: 'Name With Space')
        topic = Fabricate(:topic, category_id: category.id)
        message.header['X-Discourse-Topic-Id'] = topic.id
      end

      it 'should add the right header' do
        email_sender.send

        expect(message.header['List-ID']).to be_present
        expect(message.header['List-ID'].to_s).to match('name-with-space')
      end
    end

    context "adds a Message-ID header even when topic id is not present" do

      it 'should add the right header' do
        email_sender.send

        expect(message.header['Message-ID']).to be_present
      end
    end

    context "adds Precedence header" do
      before do
        message.header['X-Discourse-Topic-Id'] = 5577
      end

      it 'should add the right header' do
        email_sender.send
        expect(message.header['Precedence']).to be_present
      end
    end

    context "removes custom Discourse headers from topic notification mails" do
      before do
        message.header['X-Discourse-Topic-Id'] = 5577
      end

      it 'should remove the right headers' do
        email_sender.send
        expect(message.header['X-Discourse-Topic-Id']).not_to be_present
        expect(message.header['X-Discourse-Post-Id']).not_to be_present
        expect(message.header['X-Discourse-Reply-Key']).not_to be_present
      end
    end

    context "removes custom Discourse headers from digest/registration/other mails" do
      it 'should remove the right headers' do
        email_sender.send
        expect(message.header['X-Discourse-Topic-Id']).not_to be_present
        expect(message.header['X-Discourse-Post-Id']).not_to be_present
        expect(message.header['X-Discourse-Reply-Key']).not_to be_present
      end
    end

    context "email threading" do
      let(:topic) { Fabricate(:topic) }

      let(:post_1) { Fabricate(:post, topic: topic, post_number: 1) }
      let(:post_2) { Fabricate(:post, topic: topic, post_number: 2) }
      let(:post_3) { Fabricate(:post, topic: topic, post_number: 3) }
      let(:post_4) { Fabricate(:post, topic: topic, post_number: 4) }

      let!(:incoming_email) { IncomingEmail.create(topic: topic, post: post_4, message_id: "foobar") }

      let!(:post_reply_1_3) { PostReply.create(post: post_1, reply: post_3) }
      let!(:post_reply_2_3) { PostReply.create(post: post_2, reply: post_3) }

      before do
        message.header['X-Discourse-Topic-Id'] = topic.id
      end

      it "doesn't set the 'In-Reply-To' and 'References' headers on the first post" do
        message.header['X-Discourse-Post-Id'] = post_1.id

        email_sender.send

        expect(message.header['Message-Id'].to_s).to eq("<topic/#{topic.id}/#{post_1.id}@test.localhost>")
        expect(message.header['In-Reply-To'].to_s).to be_blank
        expect(message.header['References'].to_s).to be_blank
      end

      it "sets the 'In-Reply-To' header to the topic by default" do
        message.header['X-Discourse-Post-Id'] = post_2.id

        email_sender.send

        expect(message.header['Message-Id'].to_s).to eq("<topic/#{topic.id}/#{post_2.id}@test.localhost>")
        expect(message.header['In-Reply-To'].to_s).to eq("<topic/#{topic.id}@test.localhost>")
      end

      it "sets the 'In-Reply-To' header to the newest replied post" do
        message.header['X-Discourse-Post-Id'] = post_3.id

        email_sender.send

        expect(message.header['Message-Id'].to_s).to eq("<topic/#{topic.id}/#{post_3.id}@test.localhost>")
        expect(message.header['In-Reply-To'].to_s).to eq("<topic/#{topic.id}/#{post_2.id}@test.localhost>")
      end

      it "sets the 'References' header to the topic and all replied posts" do
        message.header['X-Discourse-Post-Id'] = post_3.id

        email_sender.send

        references = [
          "<topic/#{topic.id}@test.localhost>",
          "<topic/#{topic.id}/#{post_2.id}@test.localhost>",
          "<topic/#{topic.id}/#{post_1.id}@test.localhost>",
        ]

        expect(message.header['References'].to_s).to eq(references.join(" "))
      end

      it "uses the incoming_email message_id when available" do
        message.header['X-Discourse-Post-Id'] = post_4.id

        email_sender.send

        expect(message.header['Message-Id'].to_s).to eq("<#{incoming_email.message_id}>")
      end

    end

    context "merges custom mandrill header" do
      before do
        ActionMailer::Base.smtp_settings[:address] = "smtp.mandrillapp.com"
        message.header['X-MC-Metadata'] = { foo: "bar" }.to_json
      end

      it 'should set the right header' do
        email_sender.send
        expect(message.header['X-MC-Metadata'].to_s).to match(message.message_id)
      end
    end

    context "merges custom sparkpost header" do
      before do
        ActionMailer::Base.smtp_settings[:address] = "smtp.sparkpostmail.com"
        message.header['X-MSYS-API'] = { foo: "bar" }.to_json
      end

      it 'should set the right header' do
        email_sender.send
        expect(message.header['X-MSYS-API'].to_s).to match(message.message_id)
      end
    end

    context 'email logs' do
      let(:email_log) { EmailLog.last }

      it 'should create the right log' do
        email_sender.send

        expect(email_log).to be_present
        expect(email_log.email_type).to eq('valid_type')
        expect(email_log.to_address).to eq('eviltrout@test.domain')
        expect(email_log.reply_key).to be_blank
        expect(email_log.user_id).to be_blank
      end
    end

    context "email log with a post id and topic id" do
      before do
        message.header['X-Discourse-Post-Id'] = 3344
        message.header['X-Discourse-Topic-Id'] = 5577
      end

      let(:email_log) { EmailLog.last }

      it 'should create the right log' do
        email_sender.send
        expect(email_log.post_id).to eq(3344)
        expect(email_log.topic_id).to eq(5577)
      end
    end

    context "email log with a reply key" do
      before do
        message.header['X-Discourse-Reply-Key'] = reply_key
      end

      let(:email_log) { EmailLog.last }

      it 'should create the right log' do
        email_sender.send
        expect(email_log.reply_key).to eq(reply_key)
      end
    end


    context 'email parts' do
      it 'should contain the right message' do
        email_sender.send

        expect(message).to be_multipart
        expect(message.text_part.content_type).to eq('text/plain; charset=UTF-8')
        expect(message.html_part.content_type).to eq('text/html; charset=UTF-8')
        expect(message.html_part.body.to_s).to match("<p><strong>hello</strong></p>")
      end
    end
  end

  context 'with a user' do
    let(:message) do
      message = Mail::Message.new to: 'eviltrout@test.domain', body: 'test body'
      message.stubs(:deliver_now)
      message
    end

    let(:user) { Fabricate(:user) }
    let(:email_sender) { Email::Sender.new(message, :valid_type, user) }

    before do
      email_sender.send
      @email_log = EmailLog.last
    end

    it 'should have the current user_id' do
      expect(@email_log.user_id).to eq(user.id)
    end

  end

end
